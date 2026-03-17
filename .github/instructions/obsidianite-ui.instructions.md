---
applyTo: "packages/*/components/ui/**/*.tsx,packages/plugin/views/**/*.tsx"
---

# Obsidianite UI Instructions

When editing files in this scope, preserve the Obsidianite visual system.

- Build depth through layered surfaces. Nested containers should step upward in elevation instead of flattening into one background tone.
- Prefer existing CSS variables, design tokens, and semantic utility classes over hardcoded colors.
- Treat cards, dialogs, dropdowns, tabs, badges, inputs, and buttons as part of one cohesive dark neon design language.
- Use restrained cyan and pink accents for interaction, emphasis, and status, not as full-surface fill colors.
- Hover, focus, and active states should feel slightly more elevated or luminous than resting states.
- Keep contrast readable. Muted text should still be legible on dark surfaces.
- Favor subtle gradients, border glow, and shadow layering over flat fills when adding emphasis.

Use this depth model unless the surrounding file already establishes a stronger local pattern:

- Layer 0: `#0a0910` for the deepest background
- Layer 1: `#0d0b12` for recessed surfaces such as inputs or side panels
- Layer 2: `#100e17` for primary panel backgrounds
- Layer 3: `#191621` for cards, modals, and dropdowns
- Layer 4: `#1e1a2e` for hovered or elevated surfaces
- Layer 5: `#252136` for topmost popovers, tooltips, or strongly focused elements

Accent guidance:

- Cyan accent: `#0fb6d6`
- Pink accent: `#f4569d`
- Success: `#50fa7b`
- Warning: `#ffb74d`
- Muted supporting text can lean blue, such as `#7aa2f7` or `#45aaff`

Implementation rules:

- Do not introduce random new brand colors when an existing token or Obsidianite accent already fits.
- For interactive styling, prefer token-backed borders, backgrounds, glows, and gradients.
- If a component sits inside another surfaced container, make the child slightly more elevated than the parent.
- Keep typography clean and deliberate; avoid generic-looking default UI styling.
