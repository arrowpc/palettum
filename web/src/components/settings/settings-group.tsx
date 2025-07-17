import React from "react";
import { cn } from "@/lib/utils";

interface SettingsGroupProps {
  children: React.ReactNode;
  className?: string;
  constrainHeader?: boolean;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  children,
  className,
  constrainHeader = false,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        constrainHeader ? "items-center" : "items-stretch",
        className,
      )}
    >
      {children}
    </div>
  );
};
