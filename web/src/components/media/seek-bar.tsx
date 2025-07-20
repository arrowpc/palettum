import { Slider } from "@/components/ui/slider";
import React from "react";
import { useMediaStore } from "@/stores";
import { useRenderer } from "@/providers/renderer-provider";

interface Props {
  className?: string;
}

export default function SeekBar({ className }: Props) {
  const progress = useMediaStore((s) => s.progress);
  const setProgress = useMediaStore((s) => s.setProgress);
  const isPlaying = useMediaStore((s) => s.isPlaying);
  const meta = useMediaStore((s) => s.meta);
  const renderer = useRenderer();

  const handleValueChange = ([v]: number[]) => {
    setProgress(v);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    renderer.pause();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    renderer.seek(progress);
    if (isPlaying) {
      renderer.play();
    }
  };

  return (
    <div className={`${className ?? ""}`}>
      <Slider
        value={[progress]}
        max={meta?.duration ?? 1}
        step={1}
        onValueChange={handleValueChange}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="w-full"
      />
    </div>
  );
}
