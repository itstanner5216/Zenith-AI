import React, { useEffect, useRef, useState } from "react";
import { MarkdownRenderer, MarkdownView, TFile } from "obsidian";
import { logger } from "../../../../services/logger";
import { usePlugin } from "../../provider";

interface MarkdownContentProps {
  content: string;
  className?: string;
  children?: React.ReactNode;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = "",
  children,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const plugin = usePlugin();
  const [activeFile, setActiveFile] = useState<TFile | null>(null);
  const [renderedContent, setRenderedContent] = useState("");

  // Link click handler
  useEffect(() => {
    if (!contentRef.current) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkEl = target.closest("a");

      if (!linkEl) return;

      const href = linkEl.getAttribute("href");
      if (!href) return;

      if (href.startsWith("http://") || href.startsWith("https://")) {
        return;
      }

      e.preventDefault();

      let linktext = href;
      if (href.startsWith("[[")) {
        linktext = href.replace(/^\[\[/, "").replace(/\]\]$/, "");
      }

      plugin.app.workspace.openLinkText(
        linktext,
        activeFile?.path || "",
        e.ctrlKey || e.metaKey
      );
    };

    contentRef.current.addEventListener("click", handleLinkClick);
    return () => {
      contentRef.current?.removeEventListener("click", handleLinkClick);
    };
  }, [plugin.app, activeFile, contentRef.current]);

  // Markdown rendering
  useEffect(() => {
    const renderMarkdown = async () => {
      if (!plugin.app) return;

      try {
        const leaf = plugin.app.workspace.getMostRecentLeaf();
        const tempContainer = document.createElement("div");

        if (leaf?.view instanceof MarkdownView) {
          await MarkdownRenderer.render(
            plugin.app,
            content,
            tempContainer,
            leaf.view.file?.path || "",
            leaf.view
          );
        } else {
          await MarkdownRenderer.renderMarkdown(
            content,
            tempContainer,
            "",
            plugin
          );
        }

        // Tighten loose lists: unwrap <p> from inside <li> to remove extra spacing
        const listItems = tempContainer.querySelectorAll("li");
        listItems.forEach((li) => {
          const children = Array.from(li.children);
          if (children.length === 1 && children[0].tagName === "P") {
            li.innerHTML = children[0].innerHTML;
          }
        });

        setRenderedContent(tempContainer.innerHTML);
      } catch (e) {
        logger.error("Error rendering markdown:", e);
        setRenderedContent(`<p>Error rendering content: ${e.message}</p>`);
      }
    };

    renderMarkdown();
  }, [content, plugin.app]);

  // File tracking
  useEffect(() => {
    if (!plugin.app) return;
    const updateActiveFile = () =>
      setActiveFile(plugin.app.workspace.getActiveFile());
    updateActiveFile();
    plugin.app.workspace.on("file-open", updateActiveFile);
    return () => plugin.app.workspace.off("file-open", updateActiveFile);
  }, [plugin.app]);

  return (
    <div
      className={`markdown-content-wrapper ${className}`}
      style={{ margin: 0, padding: 0 }}
    >
      {children}
      <div
        ref={contentRef}
        className="markdown-rendered select-text"
        style={{ marginTop: 0, paddingTop: 0 }}
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
      <style>{`
        .markdown-content-wrapper .markdown-rendered {
          margin: 0 !important;
          padding: 0 !important;
        }
        .markdown-content-wrapper .markdown-rendered > *:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .markdown-content-wrapper .markdown-rendered p:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .markdown-content-wrapper .markdown-rendered p {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .markdown-content-wrapper .markdown-rendered ul,
        .markdown-content-wrapper .markdown-rendered ol {
          margin-top: 0.25em !important;
          margin-bottom: 0.25em !important;
          padding-left: 1.5em !important;
        }
        .markdown-content-wrapper .markdown-rendered li {
          margin-top: 0 !important;
          margin-bottom: 0.1em !important;
        }
        .markdown-content-wrapper .markdown-rendered li > p {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        /* Obsidianite Theme Styles */
        .markdown-content-wrapper .markdown-rendered code {
          background-color: rgba(14, 210, 247, 0.08) !important;
          color: var(--text-accent) !important;
          padding: 0.2em 0.4em !important;
          border-radius: 3px !important;
          font-family: 'OperatorMonoSSmLig-Book', monospace !important;
          font-size: 0.9em !important;
        }
        .markdown-content-wrapper .markdown-rendered pre {
          background-color: var(--bg-depth-3) !important;
          border: 1px solid var(--border-accent) !important;
          border-radius: 6px !important;
          padding: 12px !important;
          margin: 0.5em 0 !important;
          overflow-x: auto !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
        }
        .markdown-content-wrapper .markdown-rendered pre code {
          background-color: transparent !important;
          color: var(--text-normal) !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .markdown-content-wrapper .markdown-rendered blockquote {
          border-left: 3px solid var(--text-accent) !important;
          background-color: var(--border-subtle) !important;
          padding: 8px 12px !important;
          margin: 0.5em 0 !important;
          color: var(--text-normal) !important;
          font-style: italic !important;
        }
        .markdown-content-wrapper .markdown-rendered a {
          color: var(--text-dim) !important;
          text-decoration: none !important;
          border-bottom: 1px solid rgba(69, 170, 255, 0.3) !important;
          transition: all 0.15s ease !important;
        }
        .markdown-content-wrapper .markdown-rendered a:hover {
          color: var(--text-accent) !important;
          border-bottom-color: var(--text-accent) !important;
          text-decoration: none !important;
        }
        .markdown-content-wrapper .markdown-rendered table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 0.5em 0 !important;
          border: 1px solid var(--border-accent) !important;
        }
        .markdown-content-wrapper .markdown-rendered table th {
          background-color: var(--border-defined) !important;
          color: var(--text-accent) !important;
          padding: 8px 12px !important;
          text-align: left !important;
          font-weight: 600 !important;
          border-bottom: 2px solid var(--border-accent) !important;
        }
        .markdown-content-wrapper .markdown-rendered table td {
          padding: 8px 12px !important;
          border-bottom: 1px solid var(--border-defined) !important;
          color: var(--text-normal) !important;
        }
        .markdown-content-wrapper .markdown-rendered table tr:hover {
          background-color: var(--border-subtle) !important;
        }
        .markdown-content-wrapper .markdown-rendered strong {
          color: var(--text-accent) !important;
          font-weight: 600 !important;
        }
        .markdown-content-wrapper .markdown-rendered em {
          color: var(--text-sub-accent) !important;
          font-style: italic !important;
        }
        .markdown-content-wrapper .markdown-rendered h1,
        .markdown-content-wrapper .markdown-rendered h2,
        .markdown-content-wrapper .markdown-rendered h3,
        .markdown-content-wrapper .markdown-rendered h4,
        .markdown-content-wrapper .markdown-rendered h5,
        .markdown-content-wrapper .markdown-rendered h6 {
          color: var(--text-accent) !important;
          margin-top: 0.5em !important;
          margin-bottom: 0.25em !important;
        }
        .markdown-content-wrapper .markdown-rendered hr {
          border: none !important;
          border-top: 1px solid var(--border-accent) !important;
          margin: 0.5em 0 !important;
        }
      `}</style>
    </div>
  );
};
