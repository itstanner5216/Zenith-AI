import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[var(--border-defined)] bg-[var(--bg-depth-1)] px-3 py-2 text-sm text-[var(--text-normal)] ring-offset-[var(--bg-depth-2)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--text-dim)] placeholder:opacity-40 focus-visible:outline-none focus-visible:border-[var(--border-active)] focus-visible:ring-1 focus-visible:ring-[var(--border-accent)] focus-visible:shadow-[var(--glow-cyan-sm)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
