"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

const SeparatorRoot = SeparatorPrimitive.Root as React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> &
    React.RefAttributes<React.ElementRef<typeof SeparatorPrimitive.Root>> & {
      className?: string
    }
>

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
    className?: string
  }
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorRoot
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 border-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      style={{
        backgroundImage: orientation === "horizontal"
          ? 'var(--gradient-divider)'
          : 'linear-gradient(to bottom, #f4569d, transparent)',
      }}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator } 
