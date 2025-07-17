import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  breakpoint?: number;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className,
  breakpoint = 600,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setIsCollapsed(entry.contentRect.width < breakpoint);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [breakpoint]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "grid gap-6",
        isCollapsed ? "grid-cols-1" : "grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
};