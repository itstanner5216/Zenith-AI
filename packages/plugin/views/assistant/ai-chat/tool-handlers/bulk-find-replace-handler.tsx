import React, { useRef, useState } from "react";
import { App, TFile, Notice } from "obsidian";
import { ToolInvocation } from "./types";

interface BulkFindReplaceHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

export function BulkFindReplaceHandler({
  toolInvocation,
  handleAddResult,
  app,
}: BulkFindReplaceHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [validFiles, setValidFiles] = useState<TFile[]>([]);
  const [invalidPaths, setInvalidPaths] = useState<string[]>([]);
  const [matchCounts, setMatchCounts] = useState<
    Array<{ path: string; count: number }>
  >([]);

  React.useEffect(() => {
    const validateAndPreview = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const {
          filePaths,
          find,
          useRegex = false,
          caseSensitive = true,
        } = toolInvocation.args;

        const valid: TFile[] = [];
        const invalid: string[] = [];
        const counts: Array<{ path: string; count: number }> = [];

        for (const path of filePaths) {
          const file = app.vault.getAbstractFileByPath(path);
          if (file instanceof TFile) {
            valid.push(file);

            // Count matches
            try {
              const content = await app.vault.read(file);
              let matchCount = 0;

              if (useRegex) {
                const flags = caseSensitive ? "g" : "gi";
                const regex = new RegExp(find, flags);
                const matches = content.match(regex);
                matchCount = matches ? matches.length : 0;
              } else {
                const searchText = caseSensitive ? content : content.toLowerCase();
                const findText = caseSensitive ? find : find.toLowerCase();
                let pos = 0;
                while ((pos = searchText.indexOf(findText, pos)) !== -1) {
                  matchCount++;
                  pos += findText.length;
                }
              }

              counts.push({ path: file.path, count: matchCount });
            } catch (error) {
              counts.push({ path: file.path, count: 0 });
            }
          } else {
            invalid.push(path);
          }
        }

        setValidFiles(valid);
        setInvalidPaths(invalid);
        setMatchCounts(counts);
      }
    };

    validateAndPreview();
  }, [toolInvocation, app]);

  const handleConfirmReplace = async () => {
    const {
      find,
      replace,
      useRegex = false,
      caseSensitive = true,
    } = toolInvocation.args;

    let replacedCount = 0;
    let filesModified = 0;
    let totalMatches = 0;
    const errors: string[] = [];

    const opResults = await Promise.all(
      validFiles.map(async (file) => {
        try {
          const content = await app.vault.read(file);
          let newContent: string;
          let fileMatches = 0;

          if (useRegex) {
            const flags = caseSensitive ? "g" : "gi";
            const regex = new RegExp(find, flags);
            const matches = content.match(regex);
            fileMatches = matches ? matches.length : 0;
            newContent = content.replace(regex, replace);
          } else {
            const searchText = caseSensitive ? content : content.toLowerCase();
            const findText = caseSensitive ? find : find.toLowerCase();

            let pos = 0;
            while ((pos = searchText.indexOf(findText, pos)) !== -1) {
              fileMatches++;
              pos += findText.length;
            }

            if (caseSensitive) {
              newContent = content.split(find).join(replace);
            } else {
              const regex = new RegExp(
                find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "gi"
              );
              newContent = content.replace(regex, replace);
            }
          }

          if (newContent !== content) {
            await app.vault.modify(file, newContent);
            return { modified: true, matches: fileMatches, error: null };
          }
          return { modified: false, matches: 0, error: null };
        } catch (error) {
          return { modified: false, matches: 0, error: `${file.path}: ${error.message}` };
        }
      })
    );

    for (const r of opResults) {
      if (r.error) errors.push(r.error);
      if (r.modified) filesModified++;
      totalMatches += r.matches;
    }

    setIsDone(true);

    const message = `Replaced ${totalMatches} occurrence(s) in ${filesModified} file(s)`;

    new Notice(message);

    handleAddResult(
      JSON.stringify({
        success: true,
        filesModified,
        totalMatches,
        message,
        errors: errors.length > 0 ? errors : undefined,
      })
    );
  };

  const handleCancel = () => {
    setIsDone(true);
    handleAddResult(
      JSON.stringify({
        success: false,
        message: "User cancelled find/replace",
      })
    );
  };

  const {
    find,
    replace,
    message: reason,
    useRegex = false,
  } = toolInvocation.args;
  const isComplete = "result" in toolInvocation;

  const totalMatches = matchCounts.reduce((sum, m) => sum + m.count, 0);
  const filesWithMatches = matchCounts.filter((m) => m.count > 0).length;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#0fb6d6] text-xs">
          {isDone && !isConfirmed
            ? "✗ Find/Replace cancelled"
            : "✓ Find/Replace complete"}
        </div>
      </div>
    );
  }

  if (validFiles.length === 0) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#f4569d] text-xs">
          ✗ No valid files to search.
        </div>
      </div>
    );
  }

  if (totalMatches === 0) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#45aaff] text-xs">
          No matches found in {validFiles.length} file(s)
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-md shadow-elevation-md">
      <div className="flex items-start gap-2">
        <span className="text-[#0fb6d6] text-lg">🔍</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#bebebe] mb-1">
            Confirm Find & Replace
          </div>
          <div className="text-xs text-[#45aaff] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#45aaff] uppercase">
          Operation
        </div>
        <div className="p-2 bg-[#0d0b12] rounded border border-[rgba(14,210,247,0.05)] space-y-1">
          <div className="text-[#bebebe]">
            <strong>Find:</strong>{" "}
            <code className="px-1 bg-[#0d0b12]">{find}</code>
            {useRegex && <span className="text-[rgba(122,162,247,0.4)] ml-1">(regex)</span>}
          </div>
          <div className="text-[#bebebe]">
            <strong>Replace:</strong>{" "}
            <code className="px-1 bg-[#0d0b12]">{replace}</code>
          </div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#45aaff] uppercase">
          Impact
        </div>
        <div className="text-[#bebebe] pl-2">
          <strong>{totalMatches}</strong> match(es) in <strong>{filesWithMatches}</strong> file(s)
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#45aaff] uppercase">
          Files ({filesWithMatches} with matches)
        </div>
        {matchCounts
          .filter((m) => m.count > 0)
          .slice(0, 5)
          .map((item) => (
            <div key={item.path} className="text-[#bebebe] pl-2">
              • {item.path.split("/").pop()} ({item.count} match{item.count !== 1 ? "es" : ""})
            </div>
          ))}
        {filesWithMatches > 5 && (
          <div className="text-[rgba(122,162,247,0.4)] pl-2">
            ...and {filesWithMatches - 5} more file(s)
          </div>
        )}
      </div>

      {invalidPaths.length > 0 && (
        <div className="text-xs text-[#f4569d]">
          ⚠ {invalidPaths.length} invalid path(s) will be skipped
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[rgba(14,210,247,0.15)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.45)] hover:text-[#0fb6d6] active:scale-[0.97] transition-all duration-150"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            handleConfirmReplace();
          }}
          className="flex-1 px-3 py-1.5 text-xs rounded-md bg-[#0fb6d6] text-[#0d0b12] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
        >
          Replace {totalMatches} Match{totalMatches !== 1 ? "es" : ""}
        </button>
      </div>
    </div>
  );
}
