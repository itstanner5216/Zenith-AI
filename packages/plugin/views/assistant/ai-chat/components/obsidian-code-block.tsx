import React, { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "obsidian";
import { usePlugin } from "../../provider";

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

    el.innerHTML = "";

    const fenced = `\`\`\`${language}\n${code}\n\`\`\``;

    MarkdownRenderer.render(plugin.app, fenced, el, "", plugin);

    return () => {
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
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <div className="obsidian-code-block-wrapper relative group my-2">
      <div className="flex items-center justify-between px-3 py-1 bg-[#0d0b12] border border-b-0 border-[rgba(14,210,247,0.08)] rounded-t-md">
        <span className="text-[10px] text-[#45aaff] opacity-70 uppercase tracking-wider font-medium">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-[#45aaff] opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-[#0fb6d6] transition-all duration-150 px-2 py-0.5 rounded"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div
        ref={containerRef}
        className="obsidian-rendered-code bg-[#0d0b12] border border-[rgba(14,210,247,0.08)] rounded-b-md overflow-x-auto"
      />
    </div>
  );
};
