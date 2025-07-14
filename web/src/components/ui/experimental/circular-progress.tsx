import { cn } from '@/lib/utils';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
}

export function CircularProgress({
  progress,
  size = 16,
  strokeWidth = 2,
  className,
  showPercentage = true
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("inline-flex items-center justify-center flex-shrink-0", className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ width: size, height: size }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="opacity-20"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-in-out"
          />
        </svg>

        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-medium tabular-nums leading-none"
              style={{
                fontSize: `${size * 0.20}px`,
                lineHeight: 1
              }}
            >
              {Math.round(progress)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
