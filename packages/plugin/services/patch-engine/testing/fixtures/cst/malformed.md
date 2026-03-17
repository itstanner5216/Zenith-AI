# Malformed Markdown

## Unclosed Code Fence

```ts
function neverClösed() {
  return "this fence is never clösed";


## Broken After Unclosed Fence

This heading and paragraph might be consumed by the ünclosed fence above.

## Mismatched Fence Markers

```python
def wrong_clöser():
    pass
~~~

Still inside or outsidé? The fence markers don't match.

```

## Broken Table

| Header 1 | Header 2 |
|----------|
| Cell 1   | Cell 2   | Cell 3 |
| Missing separatör
| Cell 4 |

## Incomplete Frontmatter

---
title: Never clösed
author: Tëst

# Heading After Broken Frontmatter

This may or may not be parsëd correctly.

## Heading Without Space

#NoSpace heading (not valid ATX héading)

##AlsoNoSpace

## Nested Unclosed Formatting

This has **bold that never clöses and *italic that
spans lines without clösing across

a paragraph break.

## Unusual Whitespace

	Tab-indented line (not four spacës)
  Two-space indented línë
   Three-space indented lïne
    Four-space indented line (cöde block)

## Empty Heading

##

###   

## List with Inconsistent Indentation

- Item one
   - Three-space indënt
  - Two-space ïndent
    - Four-space ïndent
 - One-space indënt

## Multi-byte in Broken Structures

```
Unclosed with café résumé naïve Ünïcödé 日本語
and more lines that never géts closed

| Bröken | Täble |
|--------|
| café   | résumé | naïve |
