import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: consistent sizing, font, transitions, focus ring, disabled state
  "inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(14,210,247,0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-[#100e17] disabled:opacity-50 disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        // Primary: solid cyan fill — for the most important CTA in a view
        default:
          "bg-[#0fb6d6] text-[#0d0b12] font-semibold border border-[#0fb6d6] hover:bg-[rgba(14,210,247,0.85)] hover:border-[rgba(14,210,247,0.45)] shadow-glow-cyan-sm hover:shadow-glow-cyan-md active:scale-[0.97]",
        // Destructive: hot-pink for dangerous/irreversible actions
        destructive:
          "bg-[#f4569d] text-[#0d0b12] font-semibold border border-[#f4569d] hover:bg-[rgba(244,86,157,0.85)] hover:border-[rgba(244,86,157,0.85)] shadow-glow-pink-sm hover:shadow-glow-pink-md active:scale-[0.97]",
        // Outline: recessed input-style, cyan border on hover
        outline:
          "bg-[#0d0b12] text-[#bebebe] border border-[rgba(14,210,247,0.08)] hover:border-[rgba(14,210,247,0.45)] hover:text-[#0fb6d6] hover:bg-[rgba(14,210,247,0.04)] active:scale-[0.97]",
        // Secondary: mid-tone fill for secondary actions
        secondary:
          "bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border border-[rgba(14,210,247,0.15)] hover:bg-[rgba(14,210,247,0.18)] hover:border-[rgba(14,210,247,0.45)] active:scale-[0.97]",
        // Ghost: no background, just text — for tertiary/inline actions
        ghost:
          "bg-transparent text-[#45aaff] border border-transparent hover:bg-[rgba(14,210,247,0.06)] hover:text-[#0fb6d6] hover:border-[rgba(14,210,247,0.08)] active:scale-[0.97]",
        // Link: underline style
        link:
          "bg-transparent text-[#0fb6d6] border-transparent underline-offset-4 hover:underline hover:text-[rgba(14,210,247,0.8)]",
      },
      size: {
        default: "h-8 px-3 py-1.5 rounded-md",
        sm: "h-7 px-2.5 py-1 rounded text-[11px]",
        lg: "h-9 px-4 py-2 rounded-md text-sm",
        icon: "h-7 w-7 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
