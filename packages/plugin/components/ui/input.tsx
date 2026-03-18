import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[rgba(14,210,247,0.08)] bg-[#0d0b12] px-3 py-2 text-sm text-[#bebebe] ring-offset-[#100e17] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#45aaff] placeholder:opacity-40 focus-visible:outline-none focus-visible:border-[rgba(14,210,247,0.45)] focus-visible:ring-1 focus-visible:ring-[rgba(14,210,247,0.15)] focus-visible:shadow-[0_0_6px_rgba(14,210,247,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150",
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
