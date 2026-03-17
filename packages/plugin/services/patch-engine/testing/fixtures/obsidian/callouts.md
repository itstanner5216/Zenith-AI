# Callout Fixtures

> [!note]
> This is a basic note callout with a [[Résumé]] link.

> [!warning]
> Be careful when editing multi-byte wiki-links like [[日本語ノート]].

> [!tip]
> Use the `[[page#heading]]` syntax to link to specific sections.

> [!important]
> Critical information about [[Über Thème|thème handling]] goes here.

> [!note] Custom Title for Spécial Characters
> This callout has a custom title containing accented characters.
> It references [[中文笔记#标题]] for cross-language support.

> [!faq]- Collapsed by Default
> This content is hidden until the user expands it.
> See also: [[Ñoño Notes|special notes]]

> [!faq]+ Expanded by Default
> This content is visible and can be collapsed.
> Links: [[Résumé du Projet#Données]]

> [!note] Outer Callout
> This is the outer callout content.
>
> > [!warning] Inner Callout
> > This is a nested callout inside the outer one.
> > It contains a link to [[日本語ノート#セクション|日本語セクション]].

> [!tip] Multi-line Content Callout
> Here is a callout with diverse content:
>
> ```python
> def greet(name: str) -> str:
>     return f"Héllo, {name}!"
> ```
>
> - Item one with [[Résumé]]
> - Item two with [[Über Thème]]
> - Item three referencing [[中文笔记#标题|中文标题]]
>
> A paragraph after the list linking to [[日本語ノート#^block-abc]].

> [!warning] Edge Cases
> Callout with adjacent wiki-links: [[Résumé]][[日本語ノート]]
> And a piped link: [[Ñoño Notes|Ñoño display text with ñ]]
