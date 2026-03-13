"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-depth-2)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[rgba(14,210,247,0.5)] data-[state=checked]:border-[var(--text-accent)] data-[state=checked]:shadow-[0_0_6px_rgba(14,210,247,0.3)] data-[state=unchecked]:bg-[var(--bg-depth-1)] data-[state=unchecked]:border-[var(--border-accent)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-all duration-200 data-[state=checked]:translate-x-4 data-[state=checked]:bg-[var(--text-accent)] data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-[var(--text-dim)] data-[state=unchecked]:opacity-60"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch }; 