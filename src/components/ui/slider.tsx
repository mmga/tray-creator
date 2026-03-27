"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
          "bg-[#1c1a16] border-y border-[#2e2a24]"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute blood-red data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            "shadow-[0_0_6px_#8b1a1a40]"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block size-4 shrink-0 border-2 border-primary bg-[#1c1a16]",
            "shadow-[0_0_0_1px_#0a0908,0_2px_4px_#00000060]",
            "transition-all duration-200",
            "hover:bg-[#2a2520] hover:border-primary/80 hover:shadow-[0_0_8px_#b8963a30]",
            "focus-visible:outline-hidden focus-visible:shadow-[0_0_0_2px_#b8963a40]",
            "cursor-grab active:cursor-grabbing",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
          style={{ borderRadius: '2px' }}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
