import React from "react";
import { App, getLinkpath } from "obsidian";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { usePlugin } from "../provider";
import { ObsidianCodeBlock } from "./components/obsidian-code-block";

interface AIMarkdownProps {
  content: string;
  app: App;
}

export const AIMarkdown: React.FC<AIMarkdownProps> = ({ content, app }) => {
  const plugin = usePlugin();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Post-process content to convert note titles to Obsidian links
  const processedContent = React.useMemo(() => {
    // Get all markdown files from vault
    const allFiles = app.vault.getMarkdownFiles();
    const fileNames = new Set(allFiles.map(file => file.basename));

    let processed = content;

    // Skip processing if content already has Obsidian links (AI already formatted it)
    if (processed.includes("[[")) {
      return processed;
    }

    // Pattern 1: "Title: Note Name" -> "Title: [[Note Name]]"
    processed = processed.replace(
      /Title:\s*([^\n]+?)(?:\n|$|\.|,|;)/g,
      (match, title) => {
        const trimmedTitle = title.trim();
        // Remove trailing punctuation for matching
        const cleanTitle = trimmedTitle.replace(/[.,;:!?]+$/, "");
        if (fileNames.has(cleanTitle) && cleanTitle.length > 2) {
          const suffix = trimmedTitle.slice(cleanTitle.length);
          return `Title: [[${cleanTitle}]]${suffix}`;
        }
        return match;
      }
    );

    // Pattern 2: "I found a note related to 'Note Name'" or similar patterns
    processed = processed.replace(
      /(?:found|found a note|note related to|note titled|note called)[:\s]+['"]?([^'":\n]+?)['"]?(?:\s|$|\.|,|;)/gi,
      (match, title) => {
        const trimmedTitle = title.trim();
        const cleanTitle = trimmedTitle.replace(/[.,;:!?]+$/, "");
        if (fileNames.has(cleanTitle) && cleanTitle.length > 2) {
          return match.replace(trimmedTitle, `[[${cleanTitle}]]`);
        }
        return match;
      }
    );

    return processed;
  }, [content, app]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (!link) return;
      e.preventDefault();
      e.stopPropagation();

      // Try data-href first (Obsidian links), then href (markdown links)
      let linkpath =
        link.getAttribute("data-href") || link.getAttribute("href");

      if (!linkpath) return;

      // Handle markdown links that might have full URLs
      if (linkpath.startsWith("http://") || linkpath.startsWith("https://")) {
        window.open(linkpath, "_blank");
        return;
      }

      // Handle Obsidian-style links
      if (linkpath.startsWith("[[")) {
        linkpath = linkpath.replace(/^\[\[/, "").replace(/\]\]$/, "");
      }

      // Remove markdown file extension if present
      linkpath = linkpath.replace(/\.(md|markdown)$/, "");

      try {
        plugin.app.workspace.openLinkText(linkpath, "", true);
      } catch (error) {
        console.error("Error opening link:", error);
      }
    };

    container.addEventListener("click", handleClick);
    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [plugin.app]);

  return (
    <div
      className="markdown-preview-view zenith-ai-markdown"
      ref={containerRef}
      style={{ marginTop: 0, paddingTop: 0 }}
    >
      {processedContent.split(/(\[\[.*?\]\])/g).map((part, i) => {
        if (part.startsWith("[[") && part.endsWith("]]")) {
          const inner = part.slice(2, -2);
          const [target, alias] = inner.split("|");

          const linkpath = getLinkpath(target.trim());
          // get rid of extension if present for display text
          const displayText =
            alias?.trim() || target.trim().replace(/\.(md|markdown)$/, "");

          return (
            <a
              key={i}
              href={linkpath}
              className="internal-link text-neon-cyan hover:text-neon-cyan underline cursor-pointer"
              data-href={linkpath}
              rel="noopener"
              aria-label={`Open note ${displayText}`}
            >
              {displayText}
            </a>
          );
        }

        const isFirstPart = i === 0;
        const components: Components = {
          a: ({ node: _node, href, children }) => (
            <a
              href={href || ""}
              className="text-neon-cyan hover:text-neon-cyan underline cursor-pointer transition-all duration-150 hover:drop-shadow-[0_0_4px_rgba(14,210,247,0.4)]"
            >
              {children}
            </a>
          ),
          pre: ({ node: _node, children }) => {
            // react-markdown v9: block code renders as <pre><code className="language-*">
            const codeChild = React.Children.toArray(children).find(
              (child): child is React.ReactElement =>
                React.isValidElement(child) && (child as React.ReactElement).type === "code"
            );
            if (codeChild) {
              const className = (codeChild.props as { className?: string }).className || "";
              const lang = className.replace("language-", "");
              const codeStr = String(
                (codeChild.props as { children?: React.ReactNode }).children
              ).replace(/\n$/, "");
              return <ObsidianCodeBlock language={lang} code={codeStr} />;
            }
            return <pre>{children}</pre>;
          },
          code: ({ node: _node, children }) => (
            <code className="inline-code bg-depth-1 border border-accent-border px-1.5 py-0.5 rounded text-neon-cyan text-[0.8em] font-mono">
              {children}
            </code>
          ),
          p: ({ node: _node, children }) => (
            <p className={`mb-2 last:mb-0 leading-relaxed ${isFirstPart ? 'first-paragraph' : ''}`}>
              {children}
            </p>
          ),
          strong: ({ node: _node, children }) => (
            <strong className="font-semibold text-neon-cyan">
              {children}
            </strong>
          ),
          em: ({ node: _node, children }) => (
            <em className="italic text-dim opacity-85">
              {children}
            </em>
          ),
          h1: ({ node: _node, children }) => (
            <h1 className="text-lg font-bold bg-gradient-to-r from-dim to-[var(--text-faint)] bg-clip-text text-transparent mt-3 mb-1 border-b border-accent-border pb-1">{children}</h1>
          ),
          h2: ({ node: _node, children }) => (
            <h2 className="text-base font-semibold bg-gradient-to-r from-dim to-[var(--text-faint)] bg-clip-text text-transparent mt-3 mb-1">{children}</h2>
          ),
          h3: ({ node: _node, children }) => (
            <h3 className="text-sm font-semibold text-neon-cyan mt-2 mb-1">{children}</h3>
          ),
          blockquote: ({ node: _node, children }) => (
            <blockquote className="border-l-2 border-active pl-3 my-2 text-dim opacity-85 bg-gradient-to-r from-depth-3 to-transparent rounded-r-md py-1">{children}</blockquote>
          ),
          table: ({ node: _node, children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ node: _node, children }) => (
            <thead className="bg-depth-1 border-b border-accent-border">{children}</thead>
          ),
          th: ({ node: _node, children }) => (
            <th className="px-2 py-1.5 text-left text-neon-cyan font-semibold text-[10px] uppercase tracking-wider">{children}</th>
          ),
          td: ({ node: _node, children }) => (
            <td className="px-2 py-1.5 text-foreground border-b border-subtle">{children}</td>
          ),
          tr: ({ node: _node, children }) => (
            <tr className="hover:bg-[rgba(14,210,247,0.03)] transition-colors duration-100">{children}</tr>
          ),
          hr: ({ node: _node }) => (
            <hr className="my-3 border-0" style={{ background: 'linear-gradient(to right, rgba(244,86,157,0.4), transparent)', height: '1px' }} />
          ),
          li: ({ node: _node, children }) => (
            <li className="mb-0.5">{children}</li>
          ),
          ul: ({ node: _node, children }) => (
            <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
          ),
          ol: ({ node: _node, children }) => (
            <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
          ),
        };
        return (
          <ReactMarkdown key={i} components={components}>
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};
