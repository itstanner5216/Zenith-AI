import React from "react";
import { App, getLinkpath } from "obsidian";
import ReactMarkdown from "react-markdown";
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
      className="markdown-preview-view"
      ref={containerRef}
      style={{ marginTop: 0, paddingTop: 0 }}
    >
      <style>{`
        .markdown-preview-view {
          margin: 0 !important;
          padding: 0 !important;
        }
        /* Normalize first block margin - critical for alignment */
        .markdown-preview-view > *:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .markdown-preview-view p:first-child,
        .markdown-preview-view div:first-child,
        .markdown-preview-view ul:first-child,
        .markdown-preview-view ol:first-child,
        .markdown-preview-view blockquote:first-child,
        .markdown-preview-view h1:first-child,
        .markdown-preview-view h2:first-child,
        .markdown-preview-view h3:first-child,
        .markdown-preview-view h4:first-child,
        .markdown-preview-view h5:first-child,
        .markdown-preview-view h6:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .markdown-preview-view p {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* Normalize first paragraph margin */
        .markdown-preview-view p.first-paragraph {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* Override any Obsidian preview CSS that might add margins */
        .markdown-preview-view .markdown-preview-section > *:first-child {
          margin-top: 0 !important;
        }
      `}</style>
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
              className="internal-link text-[#0fb6d6] hover:text-[rgba(14,210,247,0.7)] underline cursor-pointer"
              data-href={linkpath}
              rel="noopener"
              aria-label={`Open note ${displayText}`}
            >
              {displayText}
            </a>
          );
        }

        const isFirstPart = i === 0;
        return (
          <ReactMarkdown
            key={i}
            components={{
              a: ({ href, children, ...props }) => (
                <a
                  {...props}
                  href={href || ""}
                  className="text-[#0fb6d6] hover:text-[rgba(14,210,247,0.8)] underline cursor-pointer transition-all duration-150 hover:drop-shadow-[0_0_4px_rgba(14,210,247,0.4)]"
                >
                  {children}
                </a>
              ),
              pre: ({ children }) => {
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
              code: ({ children, ...props }) => (
                <code
                  {...props}
                  className="inline-code bg-[#0d0b12] border border-[rgba(14,210,247,0.15)] px-1.5 py-0.5 rounded text-[#0fb6d6] text-[0.8em] font-mono"
                >
                  {children}
                </code>
              ),
              p: ({ children, ...props }) => (
                <p
                  {...props}
                  className={`mb-2 last:mb-0 leading-relaxed ${isFirstPart ? 'first-paragraph' : ''}`}
                >
                  {children}
                </p>
              ),
              strong: ({ children, ...props }) => (
                <strong
                  {...props}
                  className="font-semibold text-[#0fb6d6]"
                >
                  {children}
                </strong>
              ),
              em: ({ children, ...props }) => (
                <em {...props} className="italic text-[#45aaff] opacity-85">
                  {children}
                </em>
              ),
              h1: ({ children, ...props }) => (
                <h1 {...props} className="text-lg font-bold bg-gradient-to-r from-[#87c2fd] to-[#dcb9fc] bg-clip-text text-transparent mt-3 mb-1 border-b border-[rgba(14,210,247,0.15)] pb-1">{children}</h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 {...props} className="text-base font-semibold bg-gradient-to-r from-[#87c2fd] to-[#dcb9fc] bg-clip-text text-transparent mt-3 mb-1">{children}</h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 {...props} className="text-sm font-semibold text-[#0fb6d6] mt-2 mb-1">{children}</h3>
              ),
              blockquote: ({ children, ...props }) => (
                <blockquote {...props} className="border-l-2 border-[rgba(14,210,247,0.4)] pl-3 my-2 text-[#45aaff] opacity-85 bg-gradient-to-r from-[rgba(32,28,41,0.5)] to-transparent rounded-r-md py-1">{children}</blockquote>
              ),
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto my-2">
                  <table {...props} className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children, ...props }) => (
                <thead {...props} className="bg-[#0d0b12] border-b border-[rgba(14,210,247,0.2)]">{children}</thead>
              ),
              th: ({ children, ...props }) => (
                <th {...props} className="px-2 py-1.5 text-left text-[#0fb6d6] font-semibold text-[10px] uppercase tracking-wider">{children}</th>
              ),
              td: ({ children, ...props }) => (
                <td {...props} className="px-2 py-1.5 text-[#bebebe] border-b border-[rgba(14,210,247,0.06)]">{children}</td>
              ),
              tr: ({ children, ...props }) => (
                <tr {...props} className="hover:bg-[rgba(14,210,247,0.03)] transition-colors duration-100">{children}</tr>
              ),
              hr: ({ ...props }) => (
                <hr {...props} className="my-3 border-0" style={{ background: 'linear-gradient(to right, rgba(244,86,157,0.4), transparent)', height: '1px' }} />
              ),
              li: ({ children, ...props }) => (
                <li {...props} className="mb-0.5">{children}</li>
              ),
              ul: ({ children, ...props }) => (
                <ul {...props} className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
              ),
              ol: ({ children, ...props }) => (
                <ol {...props} className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
              ),
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};
