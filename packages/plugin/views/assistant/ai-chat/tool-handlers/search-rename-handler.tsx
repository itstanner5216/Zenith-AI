import React, { useState, useEffect, FC } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";
import { usePlugin } from "../../provider";

export const SearchRenameHandler: React.FC<ToolHandlerProps> = ({ toolInvocation, handleAddResult, app }) => {
  const plugin = usePlugin();
  const [matchedFiles, setMatchedFiles] = useState<TFile[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSearching) {
      try {
        const { query } = toolInvocation.args;
        const allFiles = plugin.app.vault.getMarkdownFiles();
        
        // Create a regex pattern from the query, escaping special characters
        // and replacing * with .*
        const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                            .replace(/\\\*/g, '.*');
        const regex = new RegExp(pattern, 'i');
        
        const files = allFiles.filter(file => 
          regex.test(file.basename) || regex.test(file.name)
        );
        
        setMatchedFiles(files);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error("Search error:", err);
      }
      setIsSearching(false);
    }
  }, [toolInvocation.args, isSearching, plugin.app.vault]);

  const handleSearch = () => {
    const results = matchedFiles.map(file => ({
      path: file.path,
      name: file.name,
      basename: file.basename
    }));

    handleAddResult(JSON.stringify({
      success: true,
      matchCount: matchedFiles.length,
      results
    }));
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-[var(--border-defined)]">
      <div className="text-[var(--text-normal)]">
        Searching for files matching: "{toolInvocation.args.query}"
      </div>

      {error && (
        <div className="text-[var(--text-sub-accent)] text-sm">
          Error: {error}
        </div>
      )}

      {!isSearching && !error && (
        <>
          <div className="text-sm text-[var(--text-dim)]">
            Found {matchedFiles.length} matching files:
            {matchedFiles.length > 0 && (
              <ul className="list-disc ml-4 mt-1">
                {matchedFiles.slice(0, 5).map((file, i) => (
                  <li key={i}>{file.path}</li>
                ))}
                {matchedFiles.length > 5 && (
                  <li>...and {matchedFiles.length - 5} more</li>
                )}
              </ul>
            )}
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 text-xs rounded-md bg-[var(--text-accent)] text-[var(--bg-depth-1)] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
              disabled={matchedFiles.length === 0}
            >
              Use These Files
            </button>
            <button
              onClick={() =>
                handleAddResult(
                  JSON.stringify({
                    success: false,
                    message: "Search cancelled by user",
                  })
                )
              }
              className="px-4 py-2 text-xs rounded-md border border-[var(--border-accent)] text-[var(--text-normal)] hover:bg-[rgba(14,210,247,0.06)] hover:border-[var(--border-active)] hover:text-[var(--text-accent)] active:scale-[0.97] transition-all duration-150"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
