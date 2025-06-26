import { useRef } from "react";
import { Button } from "@/components/ui/button";

const ACCEPTED = "image/*,video/*";

interface Props {
  onFile: (f: File) => void;
}

export default function InputArea({ onFile }: Props) {
  const picker = useRef<HTMLInputElement>(null);

  const stop = (e: React.DragEvent) => e.preventDefault();

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className="
        absolute inset-0 flex flex-col items-center justify-center
        space-y-4 bg-white/60 backdrop-blur-sm text-primary
        pointer-events-none
      "
      onDragEnter={stop}
      onDragOver={stop}
      onDrop={drop}
    >
      <p className="pointer-events-none text-base font-medium">
        Drag & drop, paste, or choose media
      </p>

      <Button
        type="button"
        className="pointer-events-auto px-6 py-3 text-base"
        onClick={() => picker.current?.click()}
      >
        Choose media
      </Button>

      <input
        ref={picker}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
