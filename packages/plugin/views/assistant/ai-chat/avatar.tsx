import React from "react";

export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement> & { role: "user" | "assistant" }> = ({ role, ...props }) => (
  <div {...props} className={`avatar ${role} text-foreground ${props.className || ""}`}></div>
);