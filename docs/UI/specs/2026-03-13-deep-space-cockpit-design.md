# Deep Space Cockpit UI Enhancement — Design Spec

## Goal

Transform the Zenith-AI Obsidian plugin from "good dark theme" into the best-looking plugin in Obsidian — a deep space cockpit with true dimensional depth, luminous neon accents that emit light, and premium micro-interactions on every surface.

## Inspiration

The Obsidianite theme (`/home/tanner/Obsidian-Vault-Tech/.obsidian/themes/Obsidianite/theme.css`) by Benny Guo. We take everything it does and push further on every axis.

## Skill Reference

Use `/home/tanner/Documents/zenith-ui-enhance/SKILL.md` and its reference files for Design DNA, constraints, architecture, component patterns, and review checklists.

## Worktree & Branch

- **Worktree:** `/home/tanner/Projects/Zenith-AI-components`
- **Branch:** `feat/component-token-migration`
- **CRITICAL:** Before EVERY git operation, verify with `pwd` and `git branch --show-current`

---

## Current State Analysis

### What Works
- `theme.css` defines comprehensive CSS variables: depth-0 through depth-5, glow-cyan-sm/md/lg, glow-pink-sm/md, border-subtle/defined/accent/active, gradient-heading, gradient-divider
- Button component partially migrated to CSS vars
- Message renderer uses depth vars for backgrounds
- ObsidianCodeBlock renders via Obsidian's MarkdownRenderer API
- main.css has existing keyframes: zenith-cyan-pulse, zenith-neon-pulse, zenith-typing-pulse

### Critical Bugs
1. **`--gradient-blue` and `--gradient-lavender` are UNDEFINED** — referenced in 9+ components (collapsible-section, section-header, ai-message-renderer, chat-history-sidebar, onboarding-wizard, SourcesSection) but never declared in any CSS. All gradient headings render as invisible text.
2. **`bg-card` has no depth mapping** — Card component uses `bg-card` which isn't mapped to the Obsidianite depth system in tailwind.config.js
3. **tailwind.config.js missing token bridge** — No depth, glow, border, or gradient utilities. Developers forced to use `bg-[var(--bg-depth-2)]` or worse, hardcode hex

### Where Obsidianite Stopped (Our Enhancement Targets)
1. **Zero glow** — Accents are flat colors, nothing emits light
2. **No elevation shadows** — No z-axis separation between surfaces
3. **No hover micro-interactions** — No lift, scale, or glow responses
4. **No pulse/breathing** — Static indicators, no alive feeling
5. **No gradient borders** — All solid or transparent
6. **No ambient lighting** — No light-spill simulation from accents
7. **Flat focus states** — Browser defaults
8. **Inconsistent transitions** — Most state changes are instant
9. **Limited depth range** — Only 3 layers used, depth-0 void unused
10. **Heading gradients only on bold text** — Plugin headings should shimmer too

---

## Design DNA (Source of Truth)

### Background Depth System
| Layer | Hex | Usage |
|-------|-----|-------|
| 0 (Void) | `#0a0910` | Outer containers, deepest void |
| 1 (Deepest) | `#0d0b12` | Inputs, dropdowns, recessed elements |
| 2 (Primary) | `#100e17` | Page backgrounds, chat body |
| 3 (Elevated) | `#191621` | Cards, panels, modals |
| Border | `#101014` | Structural borders |

### Primary Accent — Neon Cyan
- Solid: `#0fb6d6`
- RGB reference: `#3dd7fb`
- Opacity scale: 0.05 (borders) → 0.08 (card borders) → 0.12 (input borders) → 0.15 (tags) → 0.25 (highlights) → 0.5 (interactive) → 0.8 (hover) → 0.9 (inline code)

### Secondary Accent — Hot Pink
- Solid: `#f4569d`
- 0.25 (highlight bg), 0.55 (link underlines)

### Text Hierarchy
- Body: `#bebebe`
- Dim: `#45aaff` (descriptions, helper text)
- Faint: `#7aa2f7` (watermarks, very subtle)
- Headings h2-h6: `#cbdbe5`
- Heading h1: `#0fb6d6`
- Gradient stops: `#87c2fd` (blue) → `#dcb9fc` (lavender)

### Glow System (from theme.css)
- `--glow-cyan-sm: 0 0 6px rgba(14,210,247,0.2)`
- `--glow-cyan-md: 0 0 12px rgba(14,210,247,0.35)`
- `--glow-cyan-lg: 0 0 20px rgba(14,210,247,0.5)`
- `--glow-pink-sm: 0 0 6px rgba(244,86,157,0.2)`
- `--glow-pink-md: 0 0 12px rgba(244,86,157,0.35)`

### Hard Constraints
- NO new npm dependencies
- NO new CSS files (use main.css for additions)
- Palette locked to Design DNA colors only
- Don't break existing TypeScript (23 pre-existing errors)
- Don't replace ReactMarkdown wholesale
- Don't modify MarkdownContent component
- Append new CSS to END of main.css

---

## Architecture: 6-Layer Enhancement

### Layer 1: Token Architecture (Foundation)
Fix `tailwind.config.js` to bridge `theme.css` variables:
- Add depth colors: `depth-0` through `depth-3`
- Add card/card-foreground for Shadcn
- Add boxShadow: glow-cyan-sm/md/lg, glow-pink-sm/md
- Add borderColor: subtle/defined/accent/active
- Add `--gradient-blue: #87c2fd` and `--gradient-lavender: #dcb9fc` to theme.css

### Layer 2: Enhanced Depth System
- Outer containers → depth-0 (true void)
- Page backgrounds → depth-1/depth-2
- Cards/sections → depth-3 with `shadow-[0_2px_8px_rgba(0,0,0,0.4)]`
- Hover on elevated → depth-4 with increased shadow + faint cyan glow bleed
- Inputs → depth-1 (recessed INTO the surface)

### Layer 3: Glow System
- Spinners: `filter: drop-shadow(0 0 4px rgba(14,210,247,0.4))`
- Focused inputs: `shadow glow-cyan-sm`
- Button hover: `glow-cyan-sm → glow-cyan-md`
- Active sidebar items: sustained glow
- Code block header: faint glow line on bottom border

### Layer 4: Interaction Polish
- Cards: `hover:translate-y-[-1px]` + glow + transition 200ms
- Buttons: `active:scale-[0.97]` + hover glow surge
- Borders: `transition-colors duration-200`
- Collapsible sections: expand glow when opened
- Messages: user=pink glow, assistant=cyan glow, lift on hover

### Layer 5: Pulse & Breathing
- Activate zenith-cyan-pulse on loading indicators, recording states
- zenith-typing-pulse on AI typing dots
- Subtle opacity breathe on status indicators

### Layer 6: Detail Crispness
- Scrollbar: themed with depth + hover glow
- Gradient headings throughout (fix broken vars)
- HR dividers: pink gradient (not jarring solid)
- Section header underlines: use --gradient-divider
- Description text: proper --text-dim opacity
- styles.css sync classes: migrate hardcodes to variables
- Move <style> injection from ai-message-renderer to main.css

---

## Key Files to Modify

### Infrastructure
- `packages/plugin/tailwind.config.js` — Token bridge
- `packages/plugin/theme.css` — Add missing variables
- `main.css` — Add new utility classes, move injected styles
- `packages/plugin/styles.css` — Migrate hardcoded sync styles

### Components
- `packages/plugin/components/ui/button.tsx` — Glow system
- `packages/plugin/components/ui/card.tsx` — Depth + shadow

### Views
- `packages/plugin/views/assistant/section-header.tsx` — Gradient fix
- `packages/plugin/views/assistant/dashboard/main-dashboard.tsx` — Depth layering
- `packages/plugin/views/assistant/dashboard/collapsible-section.tsx` — Glow on expand
- `packages/plugin/views/assistant/dashboard/onboarding-wizard.tsx` — Gradient fix
- `packages/plugin/views/assistant/ai-chat/message-renderer.tsx` — Glow halos
- `packages/plugin/views/assistant/ai-chat/ai-message-renderer.tsx` — Move <style>, gradient fix, detail polish
- `packages/plugin/views/assistant/ai-chat/components/obsidian-code-block.tsx` — Glow enhancement
- `packages/plugin/views/assistant/ai-chat/components/chat-history-sidebar.tsx` — Gradient fix + glow
- `packages/plugin/views/assistant/ai-chat/components/SourcesSection.tsx` — Gradient fix
- `packages/plugin/views/assistant/organizer/organizer.tsx` — Depth + glow
- `packages/plugin/views/settings/customization-tab.tsx` — Input theming
- `packages/plugin/views/settings/general-tab.tsx` — Input theming + progress bar
- `packages/plugin/views/settings/advanced-tab.tsx` — Toggle consistency + log viewer depth

---

## Success Criteria

1. All gradient headings visible and shimmering (blue→lavender)
2. True z-axis depth: void → surfaces → elevated → hover-lifted
3. Glow halos on all interactive elements (buttons, inputs, active items)
4. Pulse animations on loading/active indicators
5. Smooth transitions on every state change (no instant jumps)
6. Every spinner has a cyan drop-shadow glow
7. Cards float with elevation shadows
8. Zero hardcoded hex values that should be tokens
9. Zero undefined CSS variables
10. Someone looking at a screenshot says "that looks expensive"
