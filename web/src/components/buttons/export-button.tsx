import { useState, useRef } from "react";
import { useRenderer } from "@/providers/renderer-provider";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { CircularProgress } from "@/components/ui/experimental/circular-progress";
import { proxy } from "comlink";
import { useShallow } from "zustand/react/shallow";
import { useConfigStore, useMediaStore } from "@/stores";
import { toast } from "sonner";

type ExportState = "idle" | "loading" | "progress";

export function ExportButton() {
  const renderer = useRenderer();
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("Exporting...");

  const isExportInProgressRef = useRef(false);

  const { config } = useConfigStore(
    useShallow((state) => ({ config: state.config })),
  );
  const { file } = useMediaStore(useShallow((state) => ({ file: state.file })));

  const handleExport = async () => {
    if (!renderer) {
      console.error("Renderer not initialized.");
      return;
    }

    setExportState("loading");
    setExportProgress(0);
    setExportMessage("Exporting...");
    isExportInProgressRef.current = true;

    try {
      const blob = await renderer.export(
        proxy((progress: number, message: string) => {
          if (isExportInProgressRef.current) {
            setExportState("progress");
            setExportProgress(progress);
            setExportMessage(message);
          }
        }),
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const originalFilename = file?.name.split(".")[0] || "media";
      const extension = blob.type.split("/")[1];
      const mapping = config.mapping?.toLowerCase();
      const paletteId = config.palette?.id;

      const filename = `${originalFilename}_${mapping}_${paletteId}.${extension}`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      isExportInProgressRef.current = false;
      setExportState("idle");
      setExportProgress(0);
      setExportMessage("Exporting...");
    } catch (error) {
      isExportInProgressRef.current = false;
      toast.error(
        "Failed to export media: " +
          (error instanceof Error ? error.message : String(error)),
      );
      setExportState("idle");
      setExportProgress(0);
      setExportMessage("Exporting...");
    }
  };

  return (
    <div className="self-center">
      <Button
        onClick={handleExport}
        disabled={exportState !== "idle"}
        className="flex items-center"
      >
        {exportState === "idle" && (
          <>
            <Download className="mr-2 h-4 w-4 flex-shrink-0" />
            Export
          </>
        )}
        {exportState === "loading" && (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
            Exporting...
          </>
        )}
        {exportState === "progress" && (
          <>
            <CircularProgress
              progress={exportProgress}
              size={30}
              strokeWidth={3.5}
              showPercentage={true}
              className="text-xs"
            />
            {exportMessage}
          </>
        )}
      </Button>
    </div>
  );
}
