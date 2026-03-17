# Nested Blockquote Fixtures

## Single Level

> This is a simple single-level blockquote.
> It spans multiple lines.
> It references [[Résumé du Projet]].

## Double Level

> First level of quoting.
> This introduces context.
>
> > Second level provides a deeper citation.
> > See [[日本語ノート]] for the original source.

## Triple Level

> Level one context.
>
> > Level two elaboration.
> >
> > > Level three — the deepest common nesting.
> > > This references [[中文笔记#标题|Chinese heading section]].

## Four Levels Deep

> Outermost context about [[Über Thème]].
>
> > First nested level with additional detail.
> >
> > > Second nested level going deeper.
> > >
> > > > Innermost level — four levels deep.
> > > > Contains a link to [[Données Résumé#^bloc-réf]].
> > > > And another to [[café étude]].

## Mixed Content in Nested Blockquotes

> Here is a top-level blockquote with a list:
> - Item A: [[Résumé]]
> - Item B: [[日本語ノート]]
>
> > Nested blockquote with inline code: `const naïve = true;`
> >
> > ```javascript
> > function grüße(name) {
> >   return `Héllo, ${name}!`;
> > }
> > ```
> >
> > > Deepest level with a link: [[Über Thème#Einführung|Intro]]
> > > And a bold **[[中文笔记]]** reference.

## Wiki-Links with Multi-Byte Chars Inside Nested Blockquotes

> The [[Résumé du Projet]] covers the project overview.
>
> > Inside nested quote: [[日本語ノート#セクション|Japanese section]].
> > Also see [[München Übersicht]].
> >
> > > Deepest nesting with [[Ñoño Notes#Sección Española]].
> > > Cross-reference: [[café étude]] and [[Données Résumé]].

## Callout Inside a Blockquote

> This is a regular blockquote.
>
> > [!note] Nested Callout
> > This callout is inside a blockquote.
> > It links to [[Résumé du Projet#Données]].

> Context before the callout.
>
> > [!warning] Attention — Über Important
> > This warning callout is nested in a blockquote.
> > References: [[日本語ノート]] and [[中文笔记#标题]].
> >
> > - Action item: review [[Über Thème]]
> > - Action item: update [[café étude]]

## Paragraph Between Nested Blockquotes

> First blockquote referencing [[Résumé]].

Regular paragraph text separating the blockquotes with [[日本語ノート]] inline.

> Second blockquote referencing [[中文笔记]].
>
> > Nested inside the second, linking to [[Über Thème|Thème page]].
