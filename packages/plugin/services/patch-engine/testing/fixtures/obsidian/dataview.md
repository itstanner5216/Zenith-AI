# Dataview Fixtures

## TABLE Query

```dataview
TABLE file.ctime AS "Created", file.mtime AS "Modified", length(file.inlinks) AS "Inlinks"
FROM "Projects"
WHERE contains(file.name, "Résumé")
SORT file.mtime DESC
```

## LIST Query

```dataview
LIST
FROM #research AND #日本語
WHERE file.name != this.file.name
SORT file.name ASC
```

## TASK Query

```dataview
TASK
FROM "Projects/Über Thème"
WHERE !completed
GROUP BY file.link
```

## DataviewJS Block

```dataviewjs
const pages = dv.pages('"Notes/中文笔记"')
  .where(p => p.status === "active")
  .sort(p => p.file.mtime, "desc");

dv.table(
  ["Name", "Status", "Modified"],
  pages.map(p => [p.file.link, p.status, p.file.mtime])
);
```

## Another DataviewJS Block

```dataviewjs
const résumé = dv.page("Résumé du Projet");
if (résumé) {
  dv.header(3, résumé.file.name);
  dv.paragraph(`Tags: ${résumé.tags?.join(", ") ?? "none"}`);
}
```

## Inline Dataview

The current file name is `= this.file.name` and today is `= date(today)`.

This note has `= length(this.file.inlinks)` inlinks and `= length(this.file.outlinks)` outlinks.

The creation date was `= this.file.ctime` for this document about [[Résumé du Projet]].

## Inline in Mixed Paragraphs

According to [[日本語ノート]], there are `= length(this.file.tags)` tags on this page.
The project [[Über Thème|Thème Overview]] was last modified on `= this.file.mtime`.
See [[中文笔记#标题]] for the full breakdown with `= date(today) - this.file.ctime` days since creation.
