import React from "react";
import { cn } from "@/lib/utils";

interface DynamicGridProps {
  children: React.ReactNode;
  className?: string;
}

export const DynamicGrid: React.FC<DynamicGridProps> = ({
  children,
  className,
}) => {
  const childArray = React.Children.toArray(children);
  const totalElements = childArray.length;

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-8 items-start",
        className,
      )}
    >
      {childArray.map((child, index) => {
        const isLastElement = index === totalElements - 1;
        const isOddTotal = totalElements % 2 === 1;
        const shouldSpanFull = isLastElement && isOddTotal;

        return (
          <div key={index} className={cn(shouldSpanFull && "md:col-span-2")}>
            {child}
          </div>
        );
      })}
    </div>
  );
};
