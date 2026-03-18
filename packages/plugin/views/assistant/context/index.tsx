import React, { useState, useEffect, useCallback } from "react";
import { TFile } from "obsidian";
import { usePlugin } from "../provider";
import { tw } from "../../../lib/utils";
import { Compass, FileText } from "lucide-react";
import type { VaultSearchResult } from "../../../services/vertex-brain-client";

export function ProjectContextTab() {
  const plugin = usePlugin();
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [relatedFiles, setRelatedFiles] = useState<VaultSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>("");

  const detectProjectFromPath = useCallback((filePath: string): string | null => {
    const projectsPath = plugin.settings.projectsPath;
    if (!projectsPath) return null;
    const escapedPath = projectsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = filePath.match(new RegExp(`${escapedPath}/([^/]+)`));
    return match ? match[1] : null;
  }, [plugin.settings.projectsPath]);

  const updateContext = useCallback(async (conversationSummary: string, activeFile: TFile | null) => {
    if (!plugin.vertexBrainClient) return;

    if (activeFile) {
      const projectPath = detectProjectFromPath(activeFile.path);
      if (projectPath) setActiveProject(projectPath);
    }

    setIsLoading(true);
    try {
      const results = await plugin.vertexBrainClient.vectorSearch(
        conversationSummary.slice(0, 2000),
        15
      );
      setRelatedFiles(results.filter(r => r.similarity > 0.65));
      setLastQuery(conversationSummary.slice(0, 100));
    } catch (e) {
      console.error("[ZenithAI] Context search failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [plugin.vertexBrainClient, detectProjectFromPath]);

  useEffect(() => {
    const handler = (data: any) => {
      updateContext(data.conversationSummary, data.activeFile);
    };
    (plugin.app.workspace as any).on("vault-intelligence:chat-turn", handler);
    return () => {
      (plugin.app.workspace as any).off("vault-intelligence:chat-turn", handler);
    };
  }, [plugin.app.workspace, updateContext]);

  const openFile = (filePath: string) => {
    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      plugin.app.workspace.getLeaf().openFile(file);
    }
  };

  return (
    <div className={tw("flex flex-col h-full p-3 overflow-y-auto")}>
      <div className={tw("flex items-center gap-2 mb-4")}>
        <Compass className="w-4 h-4 text-[#0fb6d6]" />
        <h3 className={tw("text-sm font-semibold text-[#bebebe]")}>
          Cosmic Context
        </h3>
      </div>

      {/* Active Project */}
      <div className={tw("mb-4 p-2 rounded border border-[rgba(14,210,247,0.08)] bg-[#0d0b12]")}>
        <div className={tw("text-[10px] uppercase tracking-wider text-[#45aaff] mb-1")}>
          Active Project
        </div>
        <div className={tw("text-sm text-[#bebebe]")}>
          {activeProject || "None detected"}
        </div>
      </div>

      {/* Related Files */}
      <div className={tw("flex-1")}>
        <div className={tw("text-[10px] uppercase tracking-wider text-[#45aaff] mb-2")}>
          Contextually Related Files
        </div>

        {isLoading && (
          <div className={tw("text-xs text-[#45aaff] animate-pulse")}>
            Searching vault...
          </div>
        )}

        {!isLoading && relatedFiles.length === 0 && (
          <div className={tw("text-xs text-[#45aaff] opacity-60")}>
            {lastQuery ? "No related files found" : "Start a chat to see related context"}
          </div>
        )}

        <div className={tw("space-y-1")}>
          {relatedFiles.map((file) => (
            <button
              key={file.id}
              onClick={() => openFile(file.id)}
              className={tw(
                "w-full text-left p-2 rounded text-xs transition-all duration-150",
                "hover:bg-[#191621] border border-transparent hover:border-[rgba(14,210,247,0.05)]",
                "flex items-center gap-2 group cursor-pointer"
              )}
            >
              <FileText className="w-3 h-3 text-[#45aaff] group-hover:text-[#0fb6d6] flex-shrink-0" />
              <span className={tw("text-[#bebebe] truncate flex-1")}>
                {file.id.replace(/\.md$/, '').split('/').pop()}
              </span>
              <span className={tw("text-[#45aaff] text-[10px] flex-shrink-0")}>
                {(file.similarity * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProjectContextTab;
