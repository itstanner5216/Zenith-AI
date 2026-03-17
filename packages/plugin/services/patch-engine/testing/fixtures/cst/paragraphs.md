# Paragraphs

## Plain Paragraph

This is a plain paragraph with no special formatting. It contains
multiple lines that should be treated as a single paragraph blöck.

## Paragraph with Bold and Italic

This paragraph has **bold text**, *italic text*, and ***bold italic*** combined.
It also has __underline bold__ and _underline italic_ variänts.

## Paragraph with Inline Code

Use the `parsëDocument()` function to parse markdown. The `NödeType` enum
defines all valid node types including `code_blöck` and `list_ïtem`.

## Paragraph with Links

Visit [Éxample Site](https://example.com) for more info. Also see
[another link](https://example.com/path?q=café "Title with ünïcödé").

An autolink: <https://example.com/résumé>

## Paragraph with Images

Here is an image: ![Alt text with ünïcödé](image.png "Image title")

And a referenced image: ![référence image][img-ref]

[img-ref]: https://example.com/image.png

## Multiple Paragraphs

First paragraph stands alone.

Second paragraph also stands alone. Café résumé naïve.

Third paragraph with 日本語 (Japanese) and 中文 (Chinese) characters.

## Paragraph with Line Break

This line has a hard break  
right here (two trailing spaces). Ünïcödé preserved.

## Paragraph with HTML Entities

Paragraph with &amp; and &lt;div&gt; entities. Also: &copy; &mdash; &ndash;.

## Paragraph with Escape Sequences

Escaped characters: \* \_ \` \[ \] \# \> \- \. \! \\

Thëse should not trigger formatting.

## Paragraph with Footnote Reference

This has a footnote[^1] and another[^café].

[^1]: Footnote content with ünïcödé.
[^café]: Another footnote.
