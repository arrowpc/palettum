import React, { useRef } from "react";
import { cn } from "@/lib/utils";

interface DashedBorderProps {
  dash?: number;
  gap?: number;
  strokeWidth?: number;
  borderRadius?: number; // px
  className?: string;
  children?: React.ReactNode;
  isSolid?: boolean;
  animationDuration?: number; // ms
}

const DashedBorder: React.FC<DashedBorderProps> = ({
  dash = 8,
  gap = 6,
  strokeWidth = 2,
  borderRadius = 0,
  className,
  children,
  isSolid = false,
  animationDuration = 500,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const animatedDash = isSolid ? dash + gap : dash;
  const animatedGap = isSolid ? 0 : gap;
  const strokeDasharray = `${animatedDash} ${animatedGap}`;

  return (
    <div ref={containerRef} className={cn("relative w-full h-full", className)}>
      <svg
        className="absolute inset-0 w-full h-full"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ borderRadius: `${borderRadius}px` }}
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
          strokeDasharray={strokeDasharray}
          style={{
            transition: `stroke-dasharray ${animationDuration}ms ease-in-out`,
          }}
        />
      </svg>
      {children}
    </div>
  );
};

export default DashedBorder;
