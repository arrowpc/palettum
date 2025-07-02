import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const ACCEPTED = "image/*,video/*";

interface Props {
  onFile: (f: File) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

export default function InputArea({ onFile, onDragStateChange }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const setDrag = (v: boolean) => {
    setDragging(v);
    onDragStateChange?.(v);
  };

  const handleFile = (f: File | undefined) => f && onFile(f);

  const dragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  };

  const dragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const dragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDrag(false);
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) =>
      handleFile(e.clipboardData?.files?.[0]);
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        "space-y-4 transition-colors pointer-events-auto",
        dragging && "bg-primary/5",
      )}
      onDragEnter={dragEnter}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
    >
      <div className="flex flex-col items-center gap-3 w-full max-w-xs text-3xl">
        <div className="flex items-center w-full gap-2">
          <span className="text-muted-foreground">Drag</span>
          <Separator className="flex-1" />
          <span className="text-muted-foreground">Paste</span>
        </div>
        <div className="flex items-center w-full gap-2">
          <Separator className="flex-1" />
          <span className="text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <Button
          className="text-3xl py-6 cursor-pointer"
          onClick={() => picker.current?.click()}
        >
          Choose Media
        </Button>
        <input
          ref={picker}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </div>
  );
}
