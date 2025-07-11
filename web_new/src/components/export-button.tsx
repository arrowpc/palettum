import { useState } from "react";
import { useConfigStore } from "@/store";
import { useRenderer } from "@/renderer-provider";
import { Button } from "./ui/button";
import * as Comlink from "comlink";
import { Download, Loader2 } from "lucide-react";
import { CircularProgress } from "./ui/circular-progress";

type ExportState = "idle" | "loading" | "progress";

export function ExportButton() {
  const { config } = useConfigStore();
  const renderer = useRenderer();
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    if (!renderer) {
      console.error("Renderer not initialized.");
      return;
    }

    setExportState("loading"); // Default to classic loading
    setExportProgress(0);

    const onProgress = (progress: number) => {
      setExportState("progress");
      setExportProgress(progress);
    };

    try {
      // For now, image and GIF don't support progress, so onProgress won't be called until 100%
      // When video exporting is implemented, we'll pass onProgress conditionally.
      const blob = await renderer.export(config, Comlink.proxy(onProgress));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `palettized_image.${blob.type.split("/")[1]}`;
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
    }
  };

  return (
    <Button onClick={handleExport} disabled={exportState !== "idle"}>
      {exportState === "idle" && (
        <>
          <Download className="mr-2 h-4 w-4" />
          Export
        </>
      )}
      {exportState === "loading" && (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      )}
      {exportState === "progress" && (
        <>
          <CircularProgress progress={exportProgress} className="mr-2" />
          Exporting...
        </>
      )}
    </Button>
  );
}

