import React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        className="absolute"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="text-gray-200 dark:text-gray-700"
          stroke="currentColor"
          fill="none"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-primary transition-all duration-300 ease-in-out"
          stroke="currentColor"
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span
        className="text-xs font-medium text-foreground"
        style={{ fontSize: size * 0.35 }}
      >
        {Math.round(progress)}%
      </span>
    </div>
  );
};

export { CircularProgress };
