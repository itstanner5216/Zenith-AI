import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(14,210,247,0.4)] focus-visible:ring-offset-1 focus-visible:ring-offset-depth-2 disabled:opacity-50 disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        default:
          "bg-neon-cyan text-[var(--text-on-accent)] font-semibold border border-neon-cyan hover:bg-[rgba(14,210,247,0.85)] hover:border-[rgba(14,210,247,0.85)] shadow-glow-cyan-sm hover:shadow-glow-cyan-md active:scale-[0.97]",
        destructive:
          "bg-neon-pink text-[var(--text-on-accent)] font-semibold border border-neon-pink hover:bg-[rgba(244,86,157,0.85)] hover:border-[rgba(244,86,157,0.85)] shadow-glow-pink-sm hover:shadow-glow-pink-md active:scale-[0.97]",
        outline:
          "bg-depth-1 text-[var(--text-normal)] border border-defined hover:border-[rgba(14,210,247,0.35)] hover:text-neon-cyan hover:bg-[rgba(14,210,247,0.04)] active:scale-[0.97]",
        secondary:
          "bg-[rgba(14,210,247,0.1)] text-neon-cyan border border-[rgba(14,210,247,0.2)] hover:bg-[rgba(14,210,247,0.18)] hover:border-accent-border active:scale-[0.97]",
        ghost:
          "bg-transparent text-neon-blue border border-transparent hover:bg-[rgba(14,210,247,0.06)] hover:text-neon-cyan hover:border-[rgba(14,210,247,0.1)] active:scale-[0.97]",
        link:
          "bg-transparent text-neon-cyan border-transparent underline-offset-4 hover:underline hover:text-[rgba(14,210,247,0.8)]",
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
