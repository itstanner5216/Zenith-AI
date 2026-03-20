"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
    className?: string
  }
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => {
    const separatorProps = {
      ref,
      decorative,
      orientation,
      className: cn(
        "shrink-0 border-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      ),
      style: {
        backgroundImage: orientation === "horizontal"
          ? 'var(--gradient-divider)'
          : 'linear-gradient(to bottom, #f4569d, transparent)',
      },
      ...props,
    }
    return <SeparatorPrimitive.Root {...separatorProps} />
  }
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator } 
