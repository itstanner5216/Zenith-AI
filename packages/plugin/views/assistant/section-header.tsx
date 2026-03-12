import * as React from "react";
import { tw } from "@/lib/utils";

interface SectionHeaderProps {
  text: string;
  icon?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ text, icon }) => {
  return (
    <div className={tw("flex items-center gap-2 mt-5 mb-2 px-3 pb-1.5")} style={{ backgroundImage: "linear-gradient(to right, rgba(244,86,157,0.5), transparent)", backgroundPosition: "0 100%", backgroundSize: "100% 1px", backgroundRepeat: "no-repeat" }}>
      {icon && <span className={tw("text-[#f4569d] text-xs flex-shrink-0")}>{icon}</span>}
      <h6 className={tw("m-0 text-xs font-semibold uppercase tracking-widest bg-gradient-to-r from-[#0fb6d6] to-[#87c2fd] bg-clip-text text-transparent")}>
        {text}
      </h6>
    </div>
  );
};