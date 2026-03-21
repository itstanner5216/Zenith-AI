# Obsidian Markdown Compatibility Matrix

> **Version:** v1 — Zenith Patch Engine  
> **Status:** Active  
> **Last Updated:** 2025-07-14

## Overview

This document defines how the Zenith patch engine handles every Obsidian-specific markdown construct. Each construct is assigned exactly one **v1 policy** that governs how the engine parses, targets, and modifies it.

### Classification Legend

| Classification | Meaning |
|---|---|
| **Structurally Supported** | Parsed into its own `StructuralNode`, targetable by hash. Full edit support. |
| **Preserved as Inline** | Stays inside its parent paragraph/section. Not independently targetable. Byte-preserved during edits to surrounding content. |
| **Opaque Block** | Own node, but only whole-block replace/delete operations (like frontmatter/tables). No partial edits. |
| **Unsupported (Fail-Closed)** | Engine does not parse. Edits to regions containing this construct require manual handling. Engine refuses automated edits. |

### Outline Behavior Legend

| Behavior | Meaning |
|---|---|
| **Own Entry** | Appears as its own entry in the document outline. |
| **Inside Parent** | Contained within its parent outline entry. |
| **Excluded** | Not shown in the outline. |

## Compatibility Matrix

| Construct | Classification | Outline Behavior | Byte-Correctness Notes |
|---|---|---|---|
| [Callout](#callout) | Opaque Block | Own Entry | Blockquote variants. Whole-block operations only. Nested callouts stay within parent. |
| [Wiki Link](#wiki-link) | Preserved as Inline | Inside Parent | Multi-byte characters in targets require byte-correct slicing. |
| [Embed](#embed) | Preserved as Inline | Inside Parent | Image and note embeds treated identically at structural level. |
| [Dataview Block](#dataview-block) | Opaque Block | Own Entry | Fenced code blocks (`dataview`/`dataviewjs` language). Opaque. |
| [Dataview Inline](#dataview-inline) | Preserved as Inline | Excluded | Inline expressions (`= ...`). Not independently targetable. |
| [Templater](#templater) | Unsupported (Fail-Closed) | Excluded | Produces arbitrary content. Engine refuses edits in regions with active directives. |
| [MathJax Block](#mathjax-block) | Opaque Block | Own Entry | Block-level `$$...$$`. Whole-block only. Delimiters must be byte-preserved. |
| [MathJax Inline](#mathjax-inline) | Preserved as Inline | Excluded | Inline `$...$`. Delimiter bytes must not be corrupted. |
| [Nested Blockquote](#nested-blockquote) | Structurally Supported | Inside Parent | Depth tracked via nesting. Full structural support. |

## Construct Details

### Callout

- **Classification:** Opaque Block
- **Outline Behavior:** Own Entry
- **Syntax:** `> [!type] Optional title`
- **Policy:** Callouts are treated as opaque blocks. The engine recognizes them as blockquote variants with a type indicator. Only whole-block replace and delete operations are supported. Nested callouts (callouts within callouts) remain within the parent callout node.
- **Byte-Correctness:** Callout type identifiers and titles must be preserved exactly. Multi-byte characters in callout content are byte-preserved during whole-block operations.
- **Fixture:** [`callouts.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/callouts.md)

### Wiki Link

- **Classification:** Preserved as Inline
- **Outline Behavior:** Inside Parent
- **Syntax:** `[[target]]`, `[[target|alias]]`, `[[target#heading]]`, `[[target#heading|alias]]`
- **Policy:** Wiki-links are inline syntax elements within paragraphs. They are not independently targetable — edits to the containing paragraph preserve wiki-links byte-for-byte. The engine does not resolve wiki-link targets.
- **Byte-Correctness:** Wiki-link targets frequently contain multi-byte characters (e.g., `[[Résumé]]`, `[[日本語ノート]]`). All slicing operations must use byte-correct offsets, not character indices.
- **Fixture:** [`wiki-links.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/wiki-links.md)

### Embed

- **Classification:** Preserved as Inline
- **Outline Behavior:** Inside Parent
- **Syntax:** `![[target]]`, `![[image.png]]`, `![[note#section]]`, `![[image.png|300]]`
- **Policy:** Embeds are inline syntax. Image embeds and note embeds are treated identically at the structural level. The engine does not resolve embed targets or validate referenced files.
- **Byte-Correctness:** Embed targets may contain multi-byte characters. The `!` prefix and `[[...]]` delimiters must be byte-preserved.
- **Fixture:** [`embeds.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/embeds.md)

### Dataview Block

- **Classification:** Opaque Block
- **Outline Behavior:** Own Entry
- **Syntax:** Fenced code blocks with language `dataview` or `dataviewjs`
- **Policy:** Dataview fenced blocks are treated as opaque code blocks. The engine recognizes the language identifier but does not parse the query/script content. Only whole-block replace and delete operations are supported.
- **Byte-Correctness:** Block content is opaque — byte-preservation is guaranteed by whole-block semantics.
- **Fixture:** [`dataview.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/dataview.md)

### Dataview Inline

- **Classification:** Preserved as Inline
- **Outline Behavior:** Excluded
- **Syntax:** `` `= expression` ``
- **Policy:** Inline Dataview expressions are preserved within their parent paragraph. They are not independently targetable and do not appear in the outline.
- **Byte-Correctness:** The backtick-equals delimiter (`` `= ``) must be preserved exactly.
- **Fixture:** [`dataview.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/dataview.md)

### Templater

- **Classification:** Unsupported (Fail-Closed)
- **Outline Behavior:** Excluded
- **Syntax:** `<% ... %>`, `<%* ... %>`, `<% tp.* %>`
- **Policy:** Templater syntax can produce arbitrary content at runtime. The engine does not parse or understand Templater directives. Any edit operation targeting a region that contains active Templater syntax will be rejected, requiring manual handling.
- **Byte-Correctness:** N/A — engine refuses to edit regions containing Templater syntax.
- **Fixture:** [`templater.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/templater.md)

### MathJax Block

- **Classification:** Opaque Block
- **Outline Behavior:** Own Entry
- **Syntax:** `$$\n...\n$$`
- **Policy:** Block-level math environments are treated as opaque blocks. Only whole-block replace and delete operations are supported. The engine does not parse LaTeX content.
- **Byte-Correctness:** The `$$` delimiters must be byte-preserved exactly. LaTeX commands within the block may contain multi-byte characters in text commands (e.g., `\text{résumé}`).
- **Fixture:** [`mathjax.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/mathjax.md)

### MathJax Inline

- **Classification:** Preserved as Inline
- **Outline Behavior:** Excluded
- **Syntax:** `$...$`
- **Policy:** Inline math expressions are preserved within their parent paragraph. They are not independently targetable. Edits to surrounding content must preserve the `$` delimiters and all content between them.
- **Byte-Correctness:** Dollar-sign delimiters must not be corrupted by edits. Multi-byte characters in `\text{}` commands must be handled correctly.
- **Fixture:** [`mathjax.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/mathjax.md)

### Nested Blockquote

- **Classification:** Structurally Supported
- **Outline Behavior:** Inside Parent
- **Syntax:** `> content`, `> > content`, `> > > content`
- **Policy:** Nested blockquotes are fully structurally supported. The engine parses them into the blockquote node type with depth tracking. Each nesting level is represented in the structural tree. Full edit operations are supported at any depth.
- **Byte-Correctness:** The `> ` prefix characters at each nesting level must be preserved. Content within blockquotes follows standard byte-correctness rules.
- **Fixture:** [`nested-blockquotes.md`](../packages/plugin/services/patch-engine/testing/fixtures/obsidian/nested-blockquotes.md)

## Test Fixtures

All fixtures are located in `packages/plugin/services/patch-engine/testing/fixtures/obsidian/`:

| File | Constructs Covered |
|---|---|
| `callouts.md` | Basic callouts, foldable callouts, nested callouts, callouts with rich content |
| `wiki-links.md` | Basic links, aliases, heading links, block references, multi-byte targets |
| `embeds.md` | Note embeds, image embeds, section embeds, sized images, multi-byte targets |
| `dataview.md` | TABLE/LIST queries, dataviewjs blocks, inline expressions |
| `templater.md` | Output tags, execution blocks, dynamic commands, templater in frontmatter |
| `mathjax.md` | Inline math, block math, math in lists/blockquotes, multi-byte in LaTeX |
| `nested-blockquotes.md` | Single through quad-nested blockquotes, mixed content at depth |
| `mixed-note.md` | Realistic note combining all constructs with multi-byte characters |

## Policy Source

The authoritative policy definitions are in TypeScript:

- **Policy file:** [`obsidian-syntax-policy.ts`](../packages/plugin/services/patch-engine/parsers/obsidian-syntax-policy.ts)
- **Policy map:** `OBSIDIAN_SYNTAX_POLICIES` — `Record<string, ObsidianSyntaxPolicy>`
- **Lookup function:** `getObsidianSyntaxPolicy(key: string): ObsidianSyntaxPolicy | undefined`

## Exit Criteria

> **Every Obsidian-specific syntax has an explicit v1 policy and at least one fixture-backed test.**

Specifically:
1. Every construct in the matrix above has a corresponding entry in `OBSIDIAN_SYNTAX_POLICIES`.
2. Every construct has at least one test fixture file exercising its syntax.
3. The `mixed-note.md` fixture combines all constructs in a realistic document.
4. Multi-byte character handling is tested in every fixture via wiki-link targets with non-ASCII characters.
5. No construct is left without a classification — unknown constructs default to `unsupported_fail_closed`.
