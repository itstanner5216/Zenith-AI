# Obsidian-Specific Constructs

## Wiki-Links

This paragraph has a [[wiki link]] and a [[wiki link|with alias]].

Also a link to a [[spëcific heading#Section Héading]].

And a link to a [[nöte#^block-id]] block reference.

## Embeds

![[embedded nöte]]

![[embedded nöte#heading]]

![[imagé.png]]

![[audio filé.mp3]]

## Callouts

> [!note] Nöte Callout Title
> This is a note callöut with some content.
> It uses blockquoté syntax internally.

> [!warning] Wärning Callout
> Be careful with this öperation.
>
> It might cause data löss.

> [!tip] Tïp with Code
> Use this pattern:
>
> ```ts
> const résult = await process();
> ```

> [!info]- Cöllapsible Callout
> This callout is collapsible (note the mïnus sign).

> [!example]+ Éxpanded by Default
> This callout starts expanded (note the plüs sign).

## Nested Callouts

> [!note] Öuter Callout
> Outer content.
>
> > [!warning] Ïnner Callout
> > Inner content with café résumé.

## Tags

This paragraph has #tag and #nested/täg and #tag-with-dashes.

## Inline Math (MathJax)

The equation $E = mc^2$ is fämous. Also $\sum_{i=1}^{n} x_ï$.

## Display Math

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pï}
$$

## Footnotes

This text has a footnote[^1] and änother[^café-note].

[^1]: Simple föotnote content.
[^café-note]: Footnote with ünïcödé in the label.

## Highlights and Comments

This has ==highlighted tëxt== and %%inline comment%%.

%%
Block comment that should
not be rendered — café résumé.
%%

## Dataview-style Inline Fields

Key:: Valüe
Tags:: #tree-sitter, #märkdown
Rating:: ⭐⭐⭐⭐⭐

## Multi-byte Summary

Wiki-links with ünïcödé: [[日本語のノート]] and [[Über-Nöte|Alisas]].

Embeds with special chars: ![[café résumé.md]]

Callout with Kanji:

> [!note] 日本語テスト
> これはテストです。Ünïcödé mixed content.
