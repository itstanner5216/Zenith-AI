import React from "react";
import { tw } from "../../../lib/utils";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div {...props} className={tw("bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-lg", className)}>
    {children}
  </div>
);