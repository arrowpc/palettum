import { useConfigStore } from "@/store";
import { useRenderer } from "@/renderer-provider";
import { Button } from "./ui/button";

export function ExportButton() {
  const { config } = useConfigStore();
  const renderer = useRenderer();

  const handleExport = async () => {
    if (!renderer) {
      console.error("Renderer not initialized.");
      return;
    }

    try {
      const blob = await renderer.export(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `palettized_image.${blob.type.split('/')[1]}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export image:", error);
      alert("Failed to export image. Please try again.");
    }
  };

  return <Button onClick={handleExport}>Export</Button>;
}
