import * as React from "react";
import { tw } from "@/lib/utils";

interface SectionHeaderProps {
  text: string;
  icon?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ text, icon }) => {
  return (
    <h6
      className={tw("text-xs font-semibold text-[#0fb6d6] uppercase tracking-wide mt-5 mb-2 px-3 pb-1")}
      style={{ borderBottom: "1px solid transparent", borderImage: "linear-gradient(to right, #f4569d, transparent) 1" }}
    >
      {icon && <span className={tw("mr-1.5")}>{icon}</span>}
      {text}
    </h6>
  );
};