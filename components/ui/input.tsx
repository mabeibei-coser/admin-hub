import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Sizing & shape — slightly taller than shadcn default for breathing room
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base md:text-sm",
        // Behavior
        "transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground",
        // File input
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Hover — subtle border tint
        "hover:border-[var(--blue-300)]",
        // Focus — modern blue glow ring (replaces stock 3px ring)
        "focus-visible:border-[var(--blue-500)] focus-visible:ring-[3px] focus-visible:ring-[oklch(0.6_0.18_252_/_0.18)] focus-visible:bg-white",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        // Dark
        "dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
