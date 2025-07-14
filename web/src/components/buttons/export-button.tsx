import { useState } from "react";
import { useConfigStore } from "@/store";
import { useRenderer } from "@/providers/renderer-provider";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { CircularProgress } from "@/components/ui/experimental/circular-progress";
import { proxy } from "comlink";

type ExportState = "idle" | "loading" | "progress";

export function ExportButton() {
  const { config } = useConfigStore();
  const renderer = useRenderer();
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("Exporting...");

  const handleExport = async () => {
    if (!renderer) {
      console.error("Renderer not initialized.");
      return;
    }

    setExportState("loading");
    setExportProgress(0);
    setExportMessage("Exporting...");

    try {
      const blob = await renderer.export(
        config,
        proxy((progress: number, message: string) => {
          setExportState("progress");
          setExportProgress(progress);
          setExportMessage(message);
        }),
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let filename = `palettized_image`;
      if (blob.type === "video/x-matroska") {
        filename += ".mkv";
      } else {
        filename += `.${blob.type.split("/")[1]}`;
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export image:", error);
      alert("Failed to export image. Please try again.");
    } finally {
      setExportState("idle");
      setExportProgress(0);
      setExportMessage("Exporting...");
    }
  };

  return (
    <div className="self-center">
      <Button onClick={handleExport} disabled={exportState !== "idle"} className="flex items-center">
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
