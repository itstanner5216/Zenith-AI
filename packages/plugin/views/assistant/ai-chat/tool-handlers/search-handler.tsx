import React, { useRef } from "react";
import { App } from "obsidian";
import { logger } from "../../../../services/logger";
import { addSearchContext, useContextItems } from "../use-context-items";
import type { GetSearchQueryPart, GetSearchQueryOutput, SearchResult } from "./types";

interface SearchHandlerProps {
  part: GetSearchQueryPart;
  onResult: (output: GetSearchQueryOutput) => void;
  app: App;
}

export function SearchHandler({ part, onResult, app }: SearchHandlerProps) {
  const hasFetchedRef = useRef(false);

  const searchNotes = async (query: string): Promise<SearchResult[]> => {
    const MAX_RESULTS = 10;
    const PREVIEW_LENGTH = 500;

    const files = app.vault.getMarkdownFiles();
    const searchTerms = query.toLowerCase().split(/\s+/);

    const searchResults = await Promise.all(
      files.map(async file => {
        const content = await app.vault.read(file);
        const lowerContent = content.toLowerCase();

        const allTermsPresent = searchTerms.every(term => {
          const regex = new RegExp(`(^|\\W)${term}(\\W|$)`, "i");
          return regex.test(lowerContent);
        });

        if (allTermsPresent) {
          return {
            title: file.basename,
            contentPreview:
              content.slice(0, PREVIEW_LENGTH) +
              (content.length > PREVIEW_LENGTH ? "..." : ""),
            contentLength: content.length,
            wordCount: content.split(/\s+/).length,
            path: file.path,
            content,
          };
        }
        return null;
      }),
    );

    const filtered = searchResults.filter(
      (r): r is NonNullable<typeof r> => r !== null,
    );
    return filtered.slice(0, MAX_RESULTS).map(({ content: _, ...metadata }) => metadata);
  };

  React.useEffect(() => {
    const run = async () => {
      if (hasFetchedRef.current || part.state === "output-available") return;
      hasFetchedRef.current = true;
      try {
        const results = await searchNotes(part.input.query);
        addSearchContext(part.input.query, results);
        onResult(results);
      } catch (error) {
        logger.error("Error searching notes:", error);
        onResult([]);
      }
    };
    run();
  }, [part, onResult, app]);

  const searchResults = useContextItems(state => state.searchResults);

  return (
    <div className="text-sm text-dim">
      {part.state !== "output-available"
        ? "Searching through your notes..."
        : Object.keys(searchResults).length > 0
          ? `Found ${Object.keys(searchResults).length} matching notes`
          : "No files matching that criteria were found"}
    </div>
  );
}
