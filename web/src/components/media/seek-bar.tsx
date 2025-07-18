import { Slider } from "@/components/ui/slider";
import React from "react";

interface Props {
  value: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export default function SeekBar({
  value,
  max,
  onChange,
  className,
  onPointerDown,
  onPointerUp,
}: Props) {
  return (
    <Slider
      value={[value]}
      max={max}
      step={1}
      onValueChange={([v]) => onChange(v)}
      className={className}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
  );
}
