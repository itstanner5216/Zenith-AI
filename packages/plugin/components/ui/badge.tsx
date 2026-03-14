import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--border-active)] focus:ring-offset-2 focus:ring-offset-[var(--bg-depth-2)]",
  {
    variants: {
      variant: {
        default:
          "bg-[rgba(14,210,247,0.1)] text-[var(--text-accent)] border-[var(--border-accent)]",
        secondary:
          "bg-[var(--bg-depth-3)] text-[var(--text-normal)] border-[var(--border-defined)]",
        destructive:
          "bg-[rgba(244,86,157,0.1)] text-[var(--text-sub-accent)] border-[rgba(244,86,157,0.2)]",
        outline: "text-[var(--text-normal)] border-[var(--border-defined)]",
        success:
          "border-transparent bg-[var(--text-success)] text-[var(--bg-depth-1)] hover:bg-[var(--text-success)]/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants } 