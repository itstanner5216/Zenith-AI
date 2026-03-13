import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: consistent sizing, font, transitions, focus ring, disabled state
  "inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(14,210,247,0.4)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-depth-2)] disabled:opacity-50 disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        // Primary: solid cyan fill — for the most important CTA in a view
        default:
          "bg-[var(--text-accent)] text-[var(--bg-depth-1)] font-semibold border border-[var(--text-accent)] hover:bg-[rgba(14,210,247,0.85)] hover:border-[rgba(14,210,247,0.85)] shadow-[0_0_8px_rgba(14,210,247,0.2)] hover:shadow-[0_0_12px_rgba(14,210,247,0.35)] active:scale-[0.97]",
        // Destructive: hot-pink for dangerous/irreversible actions
        destructive:
          "bg-[var(--text-sub-accent)] text-[var(--bg-depth-1)] font-semibold border border-[var(--text-sub-accent)] hover:bg-[rgba(244,86,157,0.85)] hover:border-[rgba(244,86,157,0.85)] shadow-[0_0_8px_rgba(244,86,157,0.2)] hover:shadow-[0_0_12px_rgba(244,86,157,0.35)] active:scale-[0.97]",
        // Outline: recessed input-style, cyan border on hover
        outline:
          "bg-[var(--bg-depth-1)] text-[var(--text-normal)] border border-[rgba(14,210,247,0.12)] hover:border-[rgba(14,210,247,0.35)] hover:text-[var(--text-accent)] hover:bg-[rgba(14,210,247,0.04)] active:scale-[0.97]",
        // Secondary: mid-tone fill for secondary actions
        secondary:
          "bg-[rgba(14,210,247,0.1)] text-[var(--text-accent)] border border-[rgba(14,210,247,0.2)] hover:bg-[rgba(14,210,247,0.18)] hover:border-[rgba(14,210,247,0.4)] active:scale-[0.97]",
        // Ghost: no background, just text — for tertiary/inline actions
        ghost:
          "bg-transparent text-[var(--text-dim)] border border-transparent hover:bg-[rgba(14,210,247,0.06)] hover:text-[var(--text-accent)] hover:border-[rgba(14,210,247,0.1)] active:scale-[0.97]",
        // Link: underline style
        link:
          "bg-transparent text-[var(--text-accent)] border-transparent underline-offset-4 hover:underline hover:text-[rgba(14,210,247,0.8)]",
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
