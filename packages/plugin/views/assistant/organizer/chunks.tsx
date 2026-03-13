import * as React from "react";
import { TFile } from "obsidian";
import ZenithAI from "../../../index";
import { logger } from "../../../services/logger";
import { MarkdownRenderer } from "obsidian";

interface DocumentChunksProps {
  plugin: ZenithAI;
  activeFile: TFile;
}

interface DocumentChunksProps {
  plugin: ZenithAI;
  activeFile: TFile;
  refreshKey?: number;
}

export const AtomicNotes: React.FC<DocumentChunksProps> = ({ plugin, activeFile, refreshKey }) => {
  const [concepts, setConcepts] = React.useState<string[]>([]);
  const [chunks, setChunks] = React.useState<{ concept: string; content: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setConcepts([]);
    setChunks([]);
  }, [activeFile, refreshKey]);

  const parseDocument = React.useCallback(async () => {
    setLoading(true);
    try {
      const content = await plugin.app.vault.read(activeFile);
      const result = await plugin.identifyConceptsAndFetchChunks(content);
      setConcepts(result.map(c => c.name));
      setChunks(result.map(c => ({ concept: c.name, content: c.chunk })));
    } catch (error) {
      logger.error("Error parsing document:", error);
    } finally {
      setLoading(false);
    }
  }, [activeFile, plugin]);

  const createFileInSameFolder = async (title: string, chunkContent: string) => {
    try {
      const folderPath = activeFile.parent?.path || "";
      const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, "-");
      const newFileName = `${sanitizedTitle}.md`;
      const fullPath = `${folderPath}/${newFileName}`;

      // Add link to parent note at the top of the content
      const parentLink = `> \n\n Source: [[${activeFile.basename}]]`;
      const contentWithLink = chunkContent + parentLink;

      // Create the new file with the markdown content
      await plugin.app.vault.create(fullPath, contentWithLink);
    } catch (error) {
      logger.error("Error creating file in folder:", error);
    }
  };

  // Render markdown content
  const renderMarkdown = React.useCallback(async (content: string, containerEl: HTMLElement) => {
    if (!content) return;
    
    try {
      await MarkdownRenderer.renderMarkdown(
        content,
        containerEl,
        activeFile.path,
        plugin
      );
    } catch (error) {
      logger.error("Error rendering markdown:", error);
      containerEl.textContent = content; // Fallback to plain text
    }
  }, [activeFile, plugin]);

  // Use effect to render markdown after component updates
  React.useEffect(() => {
    const containers = document.querySelectorAll('.chunk-markdown-content');
    containers.forEach((container) => {
      const content = container.getAttribute('data-content');
      if (content) {
        renderMarkdown(content, container as HTMLElement);
      }
    });
  }, [chunks, renderMarkdown]);

  const renderChunk = (chunk: { concept: string; content: string }, index: number) => (
    <div key={index} className="chunk-container p-4 border border-[var(--border-defined)] mb-2 bg-[var(--bg-depth-3)] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:bg-[rgba(14,210,247,0.06)] hover:border-[var(--border-accent)] transition-all duration-200">
      <div 
        className="chunk-markdown-content mb-3 text-[var(--text-normal)]"
        data-content={chunk.content}
      />
      <button
        className="bg-[var(--text-accent)] text-[var(--bg-depth-1)] px-3 py-1.5 rounded text-sm font-medium hover:bg-[rgba(14,210,247,0.8)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_8px_rgba(14,210,247,0.2)] hover:shadow-[0_0_12px_rgba(14,210,247,0.35)]"
        onClick={() => createFileInSameFolder(chunk.concept, chunk.content)}
      >
        Create note
      </button>
    </div>
  );

  return (
    <div className="document-chunks">
      <button
        onClick={parseDocument}
        disabled={loading}
        className="bg-[var(--text-accent)] text-[var(--bg-depth-1)] px-3 py-1.5 rounded text-sm font-medium hover:bg-[rgba(14,210,247,0.8)] transition-colors disabled:opacity-50 mb-4"
      >
        {loading ? "Parsing..." : "Parse Document"}
      </button>
      {concepts.map((concept, index) => (
        <div key={index} className="mb-4">
          <h4 className="text-lg font-medium mb-2">{concept}</h4>
          {chunks
            .filter(chunk => chunk.concept === concept)
            .map((chunk, chunkIndex) => renderChunk(chunk, chunkIndex))}
        </div>
      ))}
    </div>
  );
};
