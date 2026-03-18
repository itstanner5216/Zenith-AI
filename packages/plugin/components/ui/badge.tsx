import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[rgba(14,210,247,0.45)] focus:ring-offset-2 focus:ring-offset-[#100e17]",
  {
    variants: {
      variant: {
        default:
          "bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border-[rgba(14,210,247,0.15)]",
        secondary:
          "bg-[#191621] text-[#bebebe] border-[rgba(14,210,247,0.08)]",
        destructive:
          "bg-[rgba(244,86,157,0.1)] text-[#f4569d] border-[rgba(244,86,157,0.2)]",
        outline: "text-[#bebebe] border-[rgba(14,210,247,0.08)]",
        success:
          "border-transparent bg-[#50fa7b] text-[#0d0b12] hover:bg-[#50fa7b]/80",
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