import React from "react";
import { tw } from "../../../lib/utils";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div {...props} className={tw("bg-depth-3 border border-defined rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)]", className)}>
    {children}
  </div>
);