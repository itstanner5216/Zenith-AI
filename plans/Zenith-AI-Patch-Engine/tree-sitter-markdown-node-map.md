# tree-sitter Markdown → StructuralNode Mapping

> Reference for mapping CST node types produced by `tree-sitter-markdown`
> (v0.5.3, tree-sitter-md crate via Rust bridge) to the Zenith Patch
> Engine `StructuralNode` types defined in `packages/plugin/services/patch-engine/types.ts`.

## Mapping Table

| tree-sitter Node Type     | StructuralNode `type` | Notes |
|---------------------------|----------------------|-------|
| `document`                | `document`           | Root node. Always exactly one per parse tree. |
| `section`                 | `section`            | Implicit section wrapper around a heading and its content. The grammar generates sections automatically — they are **not** explicit in the markdown source. |
| `atx_heading`             | `heading`            | ATX-style headings (`#` through `######`). The heading level is determined by counting `atx_h1_marker` … `atx_h6_marker` children. |
| `setext_heading`          | `heading`            | Setext-style headings (underlined with `===` or `---`). Map to `heading` with level inferred from the underline marker type. |
| `paragraph`               | `paragraph`          | Text paragraphs. Inline formatting nodes are children but are **not** mapped to separate StructuralNodes. |
| `fenced_code_block`       | `code_block`         | Fenced code blocks (`` ``` `` or `~~~`). Language is extracted from `info_string` child. |
| `indented_code_block`     | `code_block`         | Indented code blocks (4+ spaces or 1+ tab). No language info available. |
| `list`                    | `list`               | Both ordered and unordered lists. Discriminate via child `list_item` marker type or `list_marker_dot` / `list_marker_minus` / `list_marker_star` / `list_marker_plus` children. |
| `list_item`               | `list_item`          | Individual list items. May contain nested lists, paragraphs, code blocks, and blockquotes. |
| `block_quote`             | `blockquote`         | Block quotes. Obsidian callouts (e.g. `> [!note]`) parse as `block_quote` nodes — callout type must be extracted from the first paragraph child's text. |
| `pipe_table`              | `table`              | GFM pipe tables. Contains `pipe_table_header`, `pipe_table_delimiter_row`, and `pipe_table_row` children. |
| `minus_metadata`          | `frontmatter`        | YAML frontmatter delimited by `---`. Content between delimiters is a raw text child. |
| `plus_metadata`           | `frontmatter`        | TOML frontmatter delimited by `+++`. Same structure as `minus_metadata`. |
| *(synthetic)*             | `code_symbol`        | **Not a tree-sitter node.** Extracted by re-parsing `code_block` content with a language-specific grammar (e.g. TypeScript, Python). |

## Unmapped Node Types (Inline / Structural Detail)

These tree-sitter node types are **not** mapped to `StructuralNode`. They are
either inline formatting or internal structural detail nodes:

| tree-sitter Node Type        | Category     | Notes |
|------------------------------|-------------|-------|
| `atx_h1_marker` … `atx_h6_marker` | Heading detail | Marker tokens (`#`, `##`, etc.) inside `atx_heading`. Used to determine heading level. |
| `setext_h1_underline`, `setext_h2_underline` | Heading detail | Underline markers for setext headings. |
| `heading_content`            | Heading detail | The text content node inside a heading. |
| `inline`                     | Inline container | Container for inline content within paragraphs and headings. |
| `emphasis`                   | Inline formatting | `*text*` or `_text_`. |
| `strong_emphasis`            | Inline formatting | `**text**` or `__text__`. |
| `strikethrough`              | Inline formatting | `~~text~~`. |
| `code_span`                  | Inline formatting | `` `code` `` inline code. |
| `link`                       | Inline formatting | `[text](url)` links. |
| `image`                      | Inline formatting | `![alt](url)` images. |
| `uri_autolink`               | Inline formatting | `<https://…>` autolinks. |
| `html_block`                 | Block-level HTML | Raw HTML blocks. Not mapped to any StructuralNode type. |
| `html_tag`                   | Inline HTML | Inline HTML tags within paragraphs. |
| `thematic_break`             | Block element | Horizontal rules (`---`, `***`, `___`). Not mapped. |
| `link_reference_definition`  | Reference | `[ref]: url` link reference definitions. |
| `backslash_escape`           | Inline formatting | Escaped characters `\*`, `\[`, etc. |
| `hard_line_break`            | Inline formatting | Trailing spaces or backslash line break. |
| `soft_line_break`            | Inline formatting | Regular line breaks within a paragraph. |
| `info_string`                | Code block detail | Language identifier after opening fence. |
| `code_fence_content`         | Code block detail | The actual code text inside a fenced block. |
| `list_marker_dot`            | List detail | Ordered list marker (`1.`). |
| `list_marker_minus`          | List detail | Unordered list marker (`-`). |
| `list_marker_star`           | List detail | Unordered list marker (`*`). |
| `list_marker_plus`           | List detail | Unordered list marker (`+`). |
| `list_marker_parenthesis`    | List detail | Ordered list marker (`1)`). |
| `task_list_marker_checked`   | List detail | `[x]` in task lists. |
| `task_list_marker_unchecked` | List detail | `[ ]` in task lists. |
| `block_continuation`         | Structural | Continuation markers in block quotes and list items. |
| `pipe_table_header`          | Table detail | Header row of a pipe table. |
| `pipe_table_delimiter_row`   | Table detail | Alignment delimiter row (`|---|:---:|---:|`). |
| `pipe_table_row`             | Table detail | Data row in a pipe table. |
| `pipe_table_cell`            | Table detail | Individual cell content. |
| `pipe_table_align_left`      | Table detail | Left-alignment marker. |
| `pipe_table_align_right`     | Table detail | Right-alignment marker. |
| `pipe_table_align_center`    | Table detail | Center-alignment marker. |

## Special Handling Notes

### Sections Are Implicit

The `tree-sitter-markdown` grammar wraps headings and their subsequent content
in `section` nodes. These sections are **not** present in the raw markdown
source — they are a structural convenience generated by the grammar. A document
like:

```markdown
# Heading 1
Paragraph A
## Heading 2
Paragraph B
```

Produces a tree like:

```
document
  section
    atx_heading (H1)
    paragraph (A)
    section
      atx_heading (H2)
      paragraph (B)
```

Sections nest: an H2 section is a child of the preceding H1 section. This
nesting is useful for the patch engine's `EditTarget` heading-anchor resolution.

### Obsidian Callouts

Obsidian callouts use blockquote syntax with a special first line:

```markdown
> [!note] Title
> Content
```

tree-sitter parses these as ordinary `block_quote` nodes. The callout type
(`note`, `warning`, `tip`, etc.) and title must be extracted by inspecting the
text content of the first child paragraph. The patch engine should:

1. Check if a `block_quote` has a first-child `paragraph` whose text matches
   the pattern `[!<type>]` (optionally followed by `+` or `-` for
   collapsibility, then a title).
2. Store the callout type in `NodeMetadata.label`.
3. Map to `blockquote` (callouts are a presentation-layer concern, not
   structural).

### Obsidian Wiki-Links and Embeds

Wiki-links (`[[note]]`, `[[note|alias]]`) and embeds (`![[note]]`) are **not**
recognized by the standard `tree-sitter-markdown` grammar. They appear as raw
text within `paragraph` > `inline` nodes. The patch engine does not need to
parse these at the structural level — they are inline content within paragraphs.

### MathJax / LaTeX

Inline math (`$...$`) and display math (`$$...$$`) are not recognized by the
base grammar. Display math blocks may appear as `paragraph` nodes containing
the raw `$$…$$` text. This should not affect structural parsing.

### Frontmatter Detection

The grammar distinguishes `minus_metadata` (YAML `---` delimiters) from
`plus_metadata` (TOML `+++` delimiters). Both map to the `frontmatter`
StructuralNode type. The actual frontmatter content is available as raw text
and should be parsed separately if field-level access is needed (e.g., for
`EditTarget.frontmatter` targeting).

### Code Block Language Detection

The `fenced_code_block` node has an `info_string` child that contains the
language identifier (e.g., `ts`, `python`, `json`). This is used by:

1. `NodeMetadata.language` — stored for outline generation
2. Code symbol extraction — determines which tree-sitter grammar to use for
   re-parsing the code block content

Indented code blocks have **no** language information. They should default to
`NodeMetadata.language = undefined`.

### Multi-byte / Unicode Considerations

tree-sitter uses **byte offsets** (not character offsets). For documents with
multi-byte characters (UTF-8), `startByte` and `endByte` on the Rust bridge's
`CstNode` interface represent byte positions. The patch engine must use byte
offsets consistently when:

- Computing hashes (`NodeMetadata.hash`)
- Slicing source text for excerpts (`NodeMetadata.excerptBytes`)
- Applying edits (byte-precise replacement ranges)

The `startPosition` / `endPosition` (row, column) values use **character
columns** (codepoint-based), which differ from byte offsets for multi-byte text.

### Edge Cases

| Edge Case | Behaviour |
|-----------|-----------|
| Unclosed code fence | Consumes all subsequent content as code block text until EOF. |
| Empty heading (`## `) | Valid `atx_heading` with empty `heading_content`. |
| Heading without space (`#NoSpace`) | Parsed as `paragraph`, not a heading. |
| Mismatched fence markers (`` ``` `` opened, `~~~` closed) | Only the matching marker closes the fence. `~~~` becomes code content. |
| Broken table (mismatched columns) | Partial `pipe_table` parse; malformed rows may become paragraphs. |
| Nested code in blockquotes | `fenced_code_block` inside `block_quote`. The `>` prefix is stripped by the grammar. |
| Nested code in list items | `fenced_code_block` inside `list_item`. Indentation (4+ spaces) is consumed by the list grammar. |
| Adjacent thematic breaks | Multiple `thematic_break` siblings, not nested. |

## Grammar Version

- **Grammar crate**: `tree-sitter-md` v0.5.3 (crates.io)
- **Runtime**: Rust tree-sitter bridge compiled to WASM via `wasm-bindgen`
- **Crate config**: `packages/plugin/services/patch-engine/runtime/rust-tree-sitter-bridge/Cargo.toml`
