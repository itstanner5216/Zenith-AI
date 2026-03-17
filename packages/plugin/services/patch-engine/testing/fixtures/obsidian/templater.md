---
title: <% tp.file.title %>
created: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - template
  - résumé
aliases:
  - <% tp.file.title %> Übersicht
---

# <% tp.file.title %>

## Templater Output Syntax

The current file title is: <% tp.file.title %>

Today's date: <% tp.date.now("YYYY-MM-DD HH:mm") %>

Yesterday: <% tp.date.now("YYYY-MM-DD", -1) %>

The file was created at: <% tp.file.creation_date("YYYY-MM-DD") %>

## Templater Execution Blocks

<%*
const résumé = tp.file.title;
const category = await tp.system.suggester(
  ["Recherche", "Développement", "Données"],
  ["research", "development", "data"]
);
tR += `Category: ${category}`;
_%>

<%*
const items = ["café", "résumé", "naïve", "über"];
for (const item of items) {
  tR += `- Item: ${item}\n`;
}
_%>

## Dynamic Commands

User input: <% tp.system.prompt("Enter a value for Résumé") %>

Clipboard content: <% tp.system.clipboard() %>

Selected suggester value: <% tp.system.suggester(["日本語", "中文", "Français"], ["ja", "zh", "fr"]) %>

## Templater with Multi-Byte Strings

<% `Résumé: ${tp.file.title}` %>

<% `日本語タイトル: ${tp.file.title}` %>

<% tp.file.rename(`${tp.file.title} — Über Zusammenfassung`) %>

## Mixed with Wiki-Links

This template generates a note about [[Résumé du Projet]].

Created on <% tp.date.now("YYYY-MM-DD") %>, linking to [[日本語ノート#セクション]].

See also [[Über Thème|Thème]] and [[中文笔记#标题]] for related templates.

<%*
const link = `[[Données Résumé#^bloc-réf]]`;
tR += `Reference: ${link}`;
_%>

## Templater in a List

- Item created: <% tp.date.now("YYYY-MM-DD") %>
- Author: <% tp.system.prompt("Auteur") %>
- Related: [[café étude]]
- Status: <% tp.system.suggester(["Actif", "Terminé"], ["active", "done"]) %>
