import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const toggleSwitchContainer = cva([
  "inline-flex divide-x divide-border overflow-hidden rounded-[1vw] border-2 border-solid border-primary",
  "bg-muted/80 backdrop-blur-md",
]);

const toggleSwitchButton = cva(
  [
    "px-4 py-2 text-sm font-medium uppercase tracking-wide",
    "transition-colors",
  ],
  {
    variants: {
      active: {
        true: "bg-primary text-primary-foreground",
        false: "text-muted-foreground hover:bg-accent",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export interface Option {
  label: string;
  value: string;
}

export interface ToggleSwitchProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export const ToggleSwitch = React.forwardRef<HTMLDivElement, ToggleSwitchProps>(
  ({ options, value, onChange, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toggleSwitchContainer(), className)}
        {...props}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              toggleSwitchButton({ active: option.value === value }),
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
