import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  gradient?: string;
  thumbSize?: number;
  trackWidth?: number;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    { className, gradient, style, thumbSize = 16, trackWidth = 4, ...props },
    ref,
  ) => {
    // Calculate offset for proper thumb centering
    const offset = (thumbSize - trackWidth) / 2;

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex touch-none select-none",
          props.orientation === "vertical" ? "h-full flex-col" : "w-full",
          className,
        )}
        style={{
          ...style,
          // Add padding to ensure thumb can reach the edges
          ...(props.orientation === "vertical" && {
            padding: `${thumbSize / 2}px 0`,
          }),
        }}
        {...props}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative overflow-hidden rounded-full",
            "bg-secondary mx-auto",
          )}
          style={{
            width: props.orientation === "vertical" ? trackWidth : "100%",
            height: props.orientation === "vertical" ? "100%" : trackWidth,
          }}
        >
          {gradient && (
            <div
              className="absolute inset-0"
              style={{
                background: gradient,
                borderRadius: "inherit",
              }}
            />
          )}
          <SliderPrimitive.Range
            className={cn(
              "absolute",
              props.orientation === "vertical"
                ? "w-full bottom-0"
                : "h-full left-0",
              !gradient ? "bg-primary" : "bg-transparent",
            )}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block rounded-full border border-primary/50 bg-background shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
            props.disabled ? "" : "hover:border-primary",
          )}
          style={{
            height: thumbSize,
            width: thumbSize,
            transform:
              props.orientation === "vertical"
                ? `translateX(-${offset}px)`
                : `translateY(-${offset}px)`,
          }}
        />
      </SliderPrimitive.Root>
    );
  },
);

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
