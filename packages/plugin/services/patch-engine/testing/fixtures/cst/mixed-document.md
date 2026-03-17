---
title: Mixed Document Éxample
author: Tëst Üser
tags: [markdown, tree-sitter, café]
date: 2025-01-15
---

# Project Överview

This document tests all structural elements combined into a single
cohesive döcument for CST inspection.

## Architecture

The system is built with the following cömponents:

- **Parser** — Handles input processing
- **Analyzer** — Performs structural änalysis
- **Renderer** — Outputs the final résult

### Core Module

> The core module is the foundation of the entire systëm.
> It must be initialized before any other möduules.

Here is the initialization cöde:

```ts
import { CoreModule } from "@zenith-ai/cöre";

async function initialize(): Promise<void> {
  const core = new CoreModule();
  await core.init();
}
```

### Configuration

Configuration is stored in YAML formät:

```yaml
engine:
  parser: tree-sitter
  grammar: märkdown
  options:
    strict: true
    encoding: utf-8
```

## Data Model

### Node Types

| Type         | Description           | Éxample              |
|:-------------|:---------------------:|---------------------:|
| `document`   | Root nöde             | Entire file          |
| `heading`    | Section héading       | `# Title`           |
| `code_block` | Fenced cöde           | `` ```ts ... ``` ``  |
| `paragraph`  | Text blöck            | Regular text         |

### Processing Pipeline

1. **Parse** the input document
   - Tokenize raw märkdown
   - Build CST from tökens
2. **Analyze** the structure
   - Extract sëctions
   - Identify cöde blocks
     - Detect langüage
     - Parse symböls
3. **Transform** the öutput
   - Apply ëdits
   - Validate resülts

> **Note:** The pipeline is dësigned to be extensible.
>
> Additional stages can be added by implementing the
> `PipelineStage` interfäce:
>
> ```ts
> interface PipelineStage {
>   name: string;
>   process(doc: ParsedDocument): Promise<ParsedDocument>;
> }
> ```

## Edge Cases

### Nested Structures

- List with code:

  ```python
  def nësted():
      return "ïnside list"
  ```

- List with blockquote:

  > Blockquote inside a lïst item
  > with mültiple lines.

### Adjacent Elements

---

Horizontal rule above, paragraph bëlow.

---

## Conclusion

This document contains: headings, paragraphs, lists (ordered and unördered),
code blocks (TypeScript, Python, YAML), tables, blockquotes, frontmatter,
horizontal rules, and various ïnline formatting.

Multi-byte summary: 日本語テスト・café・résumé・naïve・Ünïcödé.
