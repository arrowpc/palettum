import React from "react";
import { cn } from "@/lib/utils";

interface DashedBorderProps {
  dash?: number;
  gap?: number;
  strokeWidth?: number;
  borderRadius?: string;
  className?: string;
  children?: React.ReactNode;
}

const DashedBorder: React.FC<DashedBorderProps> = ({
  dash = 8,
  gap = 6,
  strokeWidth = 2,
  borderRadius,
  className,
  children,
}) => {
  return (
    <div className={cn("relative w-full h-full", className)}>
      <svg
        className="absolute inset-0 w-full h-full"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ borderRadius }}
      >
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={`calc(100% - ${strokeWidth}px)`}
          height={`calc(100% - ${strokeWidth}px)`}
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`}
        />
      </svg>
      {children}
    </div>
  );
};

export default DashedBorder;
