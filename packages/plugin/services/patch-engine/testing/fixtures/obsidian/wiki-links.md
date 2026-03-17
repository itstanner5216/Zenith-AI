# Wiki-Link Fixtures

## Basic Links

Here is a basic link: [[page]].

A link with display text: [[page|display text]].

Link to a heading: [[page#heading]].

Link with heading and alias: [[page#heading|alias text]].

Link with block reference: [[page#^block-id]].

## Multi-Byte Targets

- [[Résumé]] — French accented characters
- [[日本語ノート]] — Japanese characters
- [[Über Thème|Display Naïve]] — German umlaut and French accents
- [[中文笔记#标题]] — Chinese with heading
- [[Ñoño Notes#Sección Española|Sección]] — Spanish ñ
- [[Données Résumé#^bloc-réf]] — French with block reference
- [[München Übersicht#Einführung|München Intro]] — German city
- [[café étude]] — lowercase accented

## Links in Paragraphs

The document [[Résumé du Projet]] contains details about the [[日本語ノート#セクション]] system.
We also reference [[Über Thème|the thème page]] and [[中文笔记#标题|Chinese heading]] inline.

## Links in Lists

- First item links to [[Résumé]]
- Second item links to [[日本語ノート#セクション|Japanese section]]
- Third item has multiple: [[Über Thème]] and [[中文笔记]]
  - Nested list item: [[Ñoño Notes]]
  - Another nested: [[café étude#Préparation]]

## Links in a Table

| Topic | Link | Notes |
|-------|------|-------|
| French | [[Résumé]] | Accented characters |
| Japanese | [[日本語ノート]] | CJK characters |
| German | [[Über Thème\|Thème]] | Umlaut |
| Chinese | [[中文笔记#标题]] | With heading |
| Spanish | [[Ñoño Notes]] | Tilde |

## Adjacent and Edge Cases

[[Résumé]][[日本語ノート]][[中文笔记]]

Text before [[Über Thème]] text middle [[café étude]] text after.

**Bold [[Résumé]] link** and *italic [[日本語ノート]] link*.
