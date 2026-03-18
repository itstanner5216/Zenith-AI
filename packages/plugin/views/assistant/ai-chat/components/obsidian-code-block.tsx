import React, { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "obsidian";
import { usePlugin } from "../../provider";
import { Check, Copy } from "lucide-react";

interface ObsidianCodeBlockProps {
  language: string;
  code: string;
}

export const ObsidianCodeBlock: React.FC<ObsidianCodeBlockProps> = ({
  language,
  code,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const plugin = usePlugin();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !plugin) {
      return;
    }

    let cancelled = false;
    el.innerHTML = "";

    const fenced = `\`\`\`${language}\n${code}\n\`\`\``;

    (async () => {
      try {
        await MarkdownRenderer.render(plugin.app, fenced, el, "", plugin);
      } catch {
        if (!cancelled) {
          el.textContent = code;
        }
      }
    })();

    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
  }, [code, language, plugin]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard API unavailable in some contexts
    }
  };

  const displayLang = language || "text";

  return (
    <div className="obsidian-code-block-wrapper relative group my-2.5 rounded-md overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_1px_rgba(14,210,247,0.12)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d0b12] border border-b border-[rgba(14,210,247,0.08)] border-b-[rgba(14,210,247,0.12)] rounded-t-md">
        {/* Language badge with traffic-light dots */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 items-center">
            <span className="w-2 h-2 rounded-full bg-[#f4569d] opacity-60" />
            <span className="w-2 h-2 rounded-full bg-[#ffb74d] opacity-60" />
            <span className="w-2 h-2 rounded-full bg-[#50fa7b] opacity-60" />
          </div>
          <span className="text-[10px] text-[#45aaff] uppercase tracking-widest font-semibold select-none">
            {displayLang}
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-200 select-none border ${
            copied
              ? "text-[#50fa7b] bg-[rgba(80,250,123,0.1)] border-[rgba(80,250,123,0.25)] opacity-100"
              : "text-[#45aaff] opacity-0 group-hover:opacity-100 hover:text-[#0fb6d6] hover:bg-[rgba(14,210,247,0.08)] border-transparent hover:border-[rgba(14,210,247,0.15)]"
          }`}
          aria-label={copied ? "Copied!" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={10} strokeWidth={2.5} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={10} strokeWidth={2} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content rendered by Obsidian MarkdownRenderer */}
      <div
        ref={containerRef}
        className="obsidian-rendered-code bg-[#0d0b12] border border-t-0 border-[rgba(14,210,247,0.08)] rounded-b-md overflow-x-auto"
      />
    </div>
  );
};
