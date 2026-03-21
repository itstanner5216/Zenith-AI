# Background Scribe v2 — Design Plan

## What It Is

A background observer that activates when the user enters the Scribe tab.
While active, it silently listens to the chat conversation, extracts structured
decisions in real-time, and stores the full raw log. When the user is done,
a plan-writing agent synthesizes everything into an implementation plan written
to a file in the vault.

---

## Architecture

### Three components

**1. Raw Log Buffer**
Stores every chat turn verbatim as it happens.
```ts
type RawTurn = {
  turn_index: number;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};
```
Buffered in memory during the session. Flushed to Postgres after each
extraction interval and at session end. Vault file no longer needed —
Postgres is the source of truth.

---

**Storage — Postgres (Drizzle ORM, already installed in web package)**

Schema (new tables, first use of the DB):
```sql
scribe_sessions (
  id            TEXT PRIMARY KEY,   -- uuid
  vault_id      TEXT,               -- identifies the Obsidian vault
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  output_path   TEXT,               -- where the plan was written
  status        TEXT                -- active | synthesizing | complete
)

scribe_turns (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT REFERENCES scribe_sessions(id),
  turn_index    INTEGER,
  role          TEXT,               -- user | assistant
  content       TEXT,
  timestamp     TIMESTAMPTZ
)

scribe_index_entries (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT REFERENCES scribe_sessions(id),
  turn_index    INTEGER,            -- references the turn it was extracted from
  type          TEXT,               -- decision | proposal | rejected | constraint | direction
  summary       TEXT
)
```

Benefits over vault file storage:
- Full session history queryable across vaults and reinstalls
- `searchLogs` queries `scribe_turns` directly (Postgres FTS or semantic)
- Index entries and raw turns stored together per session
- Plan writer can retrieve turns by index range, role, or full-text match

---

**2. Log Compressor (TOON + one extraction call)**
Runs once when the session ends, before the plan writer is spawned.

**Step 1 — TOON pass on raw log**
Extend TOON's `encode_output` with a `string_threshold` param.
Long strings above `string_threshold` chars become:
```json
{ "__toon": true, "type": "text", "length": 4200, "preview": "first 300 chars..." }
```
Also update array sampling from `[:3]` to representative spread (first + middle + last).
This reduces raw token volume before anything else touches it.

**Step 2 — Rolling structured extraction (every N turns)**
Every N turns (default 10, configurable in settings as `scribeExtractionInterval`),
a small/fast model receives only the last N turns and appends to the extraction index:

```json
[
  { "turn": 14, "type": "decision", "summary": "use postgres not sqlite" },
  { "turn": 22, "type": "rejected", "summary": "dismissed event sourcing, too complex" },
  { "turn": 31, "type": "constraint", "summary": "must work offline" }
]
```

Types: `decision | proposal | rejected | constraint | direction`
The model only ever sees N turns at a time — never the full log.
Entries accumulate in memory and are persisted alongside the raw log.
One final extraction call runs at session end to catch any remaining turns
since the last interval.

Configurable: `scribeExtractionInterval` (number, default `10`, JSON settings only).

**Step 3 — Plan writer receives:**
- Structured extraction index (tiny)
- TOON-compressed full log (medium — full coverage, reduced size)
- `searchLogs(query)` tool — semantic search via gateway `/v1/vector-search`
  over the *uncompressed* raw turns for precision retrieval

Zero per-turn model calls during the session.
Two model calls total at session end: extractor + plan writer.

---

**Model configuration note:**
Three separate model configurations are required in the settings UI:
1. Main chat model (already exists as `selectedModel`)
2. Extraction model (small/fast — used for the structured extraction call)
3. Embeddings model (used for `searchLogs` semantic search via gateway)

Settings UI must be updated to expose all three. Details TBD in UI implementation.

---

## Session Lifecycle

```
User enters Scribe tab
  → RawLogBuffer starts recording
  → DecisionExtractor subscribes to chat turns
  → UI shows: "Zenith - Listening 0:00" timer

User chats on the Scribe tab
  → Every turn appended to raw log
  → After each assistant reply, extractor runs silently
  → Decision entries append to decision log
  → Timer runs visibly in the tab header

User clicks "Done" or leaves the Scribe tab
  → Listening stops, timer freezes
  → If buffer is empty: nothing happens, clean exit
  → If buffer has content:
      → UI enters "Compacting" state (spinner, interaction blocked)
      → Plan writer agent spawned
      → Plan writer streams its <thinking> and plan output to the UI
      → When finished: UI shows plan path, "Open" button, session clears
```

---

## UI — Scribe Tab

### Header bar (always visible while on tab)
```
[●] Zenith - Listening  2:47        [Done]
```
- Pulsing dot when active
- Timer counts up from 0:00
- "Done" button triggers synthesis immediately
- Leaving the tab also triggers synthesis if buffer has content

### Content area (while listening)
Full chat UI — same as Chat tab. The user converses with the chat model
as normal. Scribe observes silently.

### Content area (while synthesizing — "Compacting" state)
Chat is replaced with the synthesis view:
```
┌─────────────────────────────────────────┐
│  Zenith is writing your plan...         │
│                                         │
│  Thinking:                              │
│  ┌───────────────────────────────────┐  │
│  │ <streaming thinking text>         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Plan:                                  │
│  ┌───────────────────────────────────┐  │
│  │ # Implementation Plan             │  │
│  │ ## Phase 1                        │  │
│  │ - Task 1...   (streaming)         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```
Interaction is blocked during synthesis. No cancel button —
the plan writer must complete before the session can be cleared.

### Content area (synthesis complete)
```
┌─────────────────────────────────────────┐
│  ✓ Plan written to Projects/my-feature/ │
│    implementation-plan.md               │
│                                         │
│  [Open file]   [New session]            │
└─────────────────────────────────────────┘
```

---

## Data Flow

```
chat turn
  → append to RawLogBuffer (verbatim)
  → DecisionExtractor (lightweight LLM call)
      → append 0-N DecisionEntries

user done
  → PlanWriter spawned with:
      - decision_log: DecisionEntry[]
      - recent_turns: RawTurn[]   (last 10)
      - tools: [searchLogs]
  → PlanWriter streams thinking + plan to UI
  → PlanWriter calls writeFile(path, content) to output
  → Session cleared
```

---

## File Structure

```
packages/plugin/services/
  background-scribe.ts          ← existing, rewrite
  scribe-decision-extractor.ts  ← new
  scribe-plan-writer.ts         ← new

packages/plugin/views/assistant/
  view.tsx                      ← scribe tab UI (header + content states)
  scribe/
    scribe-listening-view.tsx   ← timer + done button + chat passthrough
    scribe-synthesizing-view.tsx← thinking + plan streaming view
    scribe-complete-view.tsx    ← done state, open file button
```

---

## BackgroundScribe Service — Rewrite

The current `background-scribe.ts` is structurally compatible but needs:

1. Replace the 30s debounce synthesizer with the DecisionExtractor subscription
2. Add RawLogBuffer with vault persistence
3. Remove the direct `client.answer()` call (plan writer handles synthesis)
4. Add session state machine: `idle → listening → synthesizing → complete`
5. Expose session state via events so the UI can react

State machine:
```
idle
  → activate() → listening
listening
  → deactivate() or done() → synthesizing (if buffer non-empty) | idle (if empty)
synthesizing
  → complete → complete
complete
  → reset() → idle
```

---

## Decision Extractor — Prompt

```
You are extracting structured decisions from a planning conversation.
Given the last exchange, identify any of the following if present:
- decision: something explicitly agreed upon
- direction: a high-level approach or path chosen
- proposal: an idea put forward (may or may not be accepted)
- rejection: something explicitly ruled out, and why
- constraint: a hard requirement or limitation stated

For each one found, output a single concise sentence.
If nothing significant happened in this exchange, output nothing.
Do not summarize. Do not narrate. Only extract.
```

Output: JSON array of `{ type, content }` — empty array if nothing to extract.

---

## Plan Writer — Prompt

```
You are writing an implementation plan based on a planning conversation.

You have:
1. A structured decision log — decisions, directions, rejections, constraints
   extracted in real-time from the conversation
2. The last 10 messages of the conversation verbatim
3. A searchLogs tool — use it to look up specific details from the full
   conversation when you need precision

Your output is a single markdown document:
- Title: Implementation Plan — [inferred project/feature name]
- Sections: Overview, Tasks (with dependencies), Constraints, Open Questions
- Tasks should be concrete and actionable — specific files, behaviors, interfaces
- Do not invent requirements. If something is ambiguous, use searchLogs first.
  If still ambiguous, note it as an Open Question.

Write the plan directly. Do not explain what you're doing.
```

---

## Design Decisions

1. **Output path** — User-configured in plugin settings. New setting: `scribeOutputPath`
   (string, default `"TODO.md"`). Stored in `ZenithAISettings`, exposed in Advanced tab.

2. **Log compression — TOON + single extraction call** — TOON extended with
   `string_threshold` param truncates long strings in the raw log + smart array
   sampling. One cheap model call after TOON produces a structured extraction
   index (turn index + type + one-sentence summary per significant moment).
   Rolling extraction every N turns (default 10, configurable as
   `scribeExtractionInterval` in JSON settings). Model only sees N turns at a
   time — never the full log. Index accumulates incrementally. Final partial
   flush at session end.

3. **Storage — Postgres** — Three tables: `scribe_sessions`, `scribe_turns`,
   `scribe_index_entries`. First use of the DB schema (Drizzle ORM, already
   installed). Raw turns flushed to DB at each extraction interval. Plan writer's
   `searchLogs` queries `scribe_turns` via Postgres FTS. Session history
   persists across vault changes and plugin reinstalls.

4. **searchLogs** — Postgres full-text search against `scribe_turns` for the
   current session. Returns matching turns with turn_index, role, content.
   Semantic search via gateway `/v1/vector-search` available as fallback if
   turns are embedded. FTS sufficient for v1.

5. **Multiple chats** — Scribe observes exactly one chat. The Scribe tab does not
   show the multi-session tab bar — single chat thread only.
