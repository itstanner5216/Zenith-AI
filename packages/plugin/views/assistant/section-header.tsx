import * as React from "react";
import { tw } from "@/lib/utils";

interface SectionHeaderProps {
  text: string;
  icon?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ text, icon }) => {
  return (
    <div
      className={tw("flex items-center gap-2 mt-5 mb-2 px-3 pb-1.5 border-b")}
      style={{
        borderImage: "linear-gradient(to right, var(--text-sub-accent), var(--bg-depth-2), var(--bg-depth-2)) 1",
      }}
    >
      {icon && <span className={tw("text-[var(--text-sub-accent)] text-xs flex-shrink-0")}>{icon}</span>}
      <h6 className={tw("m-0 text-xs font-semibold uppercase tracking-widest bg-gradient-to-r from-[var(--gradient-blue)] to-[var(--gradient-lavender)] bg-clip-text text-transparent")}>
        {text}
      </h6>
    </div>
  );
};
