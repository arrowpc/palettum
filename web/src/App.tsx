import { useState, useEffect, useCallback } from "react";
import ImageUpload from "@/components/ImageUpload";
import ImageDimensions from "@/components/ImageDimensions";
import PaletteManager from "@/components/PaletteManager";
import DarkModeToggle from "@/components/DarkModeToggle";
import GitHubButton from "@/components/GitHubButton";
import type { Palette } from "palettum";
import Footer from "@/components/Footer";
import AdjustmentsAccordion from "@/components/adjustments/AdjustmentsAccordion";
import {
  type MappingKey,
  MAPPING_PALETTIZED,
  MAPPING_SMOOTHED,
} from "@/components/adjustments/adjustments.types";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { initializeWorker } from "@/lib/palettumWorker";
import { useShader, ShaderProvider } from "@/ShaderContext";

if (import.meta.env.MODE === "development") {
  import("react-scan").then(({ scan }) => {
    scan({ enabled: true });
  });
}

const MAPPING_OPTIONS: MappingKey[] = [MAPPING_SMOOTHED, MAPPING_PALETTIZED];
const MAPPING_NAMES: Record<MappingKey, string> = {
  [MAPPING_SMOOTHED]: "Blend",
  [MAPPING_PALETTIZED]: "Match",
};
const MAPPING_TOOLTIPS: Record<MappingKey, string> = {
  [MAPPING_SMOOTHED]: "Blend colors based on distance weighting",
  [MAPPING_PALETTIZED]: "Match each pixel to closest palette color",
};

function AppContent() {
  useEffect(() => {
    initializeWorker()
      .then(() => {
        console.log(
          "App: Palettum worker initialized successfully on app mount.",
        );
      })
      .catch((error) => {
        console.error(
          "App: Failed to initialize palettum worker on app mount:",
          error,
        );
      });
  }, []);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // TODO: 
  const [dimensions, setDimensions] = useState({
    width: null as number | null,
    height: null as number | null,
  });

  const { shader, setShader } = useShader();

  useEffect(() => {
    if (
      shader.filter &&
      shader.config.palette &&
      shader.config.palette.colors.length > 0 &&
      uploadedFile
    ) {
      try {
        // TODO: set_shader_index should actually be done by set_config as config includes mapping!
        shader.filter?.set_shader_index(1);
        shader.filter.set_config(shader.config);
      } catch (e) {
        console.error("Error applying filter:", e);
      }
    }
  }, [shader.config, shader.filter, uploadedFile]);

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadedFile(file);
  }, []);

  const handleDimensionsChange = useCallback(
    (width: number | null, height: number | null) => {
      setDimensions({ width, height });
    },
    [],
  );

  const handlePaletteSelect = useCallback(
    (palette: Palette) => {
      setShader((prev) => ({
        ...prev,
        config: { ...prev.config, palette: palette },
      }));
    },
    [setShader],
  );

  const handleMappingChange = useCallback(
    (newMapping: MappingKey) => {
      setShader((prev) => ({
        ...prev,
        config: { ...prev.config, mapping: newMapping },
      }));
    },
    [setShader],
  );

  const renderColorMappingMethod = () => (
    <div className="space-y-3">
      <Label className="text-lg font-medium text-foreground">Style</Label>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-2">
          {MAPPING_OPTIONS.map((option) => (
            <Tooltip key={option}>
              <TooltipTrigger asChild>
                <Button
                  variant={
                    shader.config.mapping === option ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => handleMappingChange(option)}
                  className="flex-1 md:flex-initial"
                >
                  {MAPPING_NAMES[option]}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-center">{MAPPING_TOOLTIPS[option]}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8 min-h-screen flex flex-col">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Palettum</h1>
        </header>
        <div className="flex items-center justify-between gap-4 text-sm">
          <GitHubButton />
          <p className="text-l text-center text-secondary-foreground">
            Style images & GIFs to a custom palette
          </p>
          <DarkModeToggle />
        </div>

        <div className="flex-1 space-y-8">
          <Card>
            <CardContent className="p-6 space-y-4">
              <ImageUpload onFileSelect={handleFileSelect} />
              {uploadedFile && (
                <>
                  <div className="pt-4">
                    <ImageDimensions
                      file={uploadedFile}
                      onChange={handleDimensionsChange}
                    />
                  </div>
                  <div className="pt-6">{renderColorMappingMethod()}</div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                Choose Palette
              </h2>
              <PaletteManager onPaletteSelect={handlePaletteSelect} />
            </CardContent>
          </Card>

          <AdjustmentsAccordion file={uploadedFile} />
        </div>
        <Footer />
      </div>
      <Toaster richColors position="bottom-center" />
    </>
  );
}

function App() {
  return (
    <ShaderProvider>
      <AppContent />
    </ShaderProvider>
  );
}

export default App;
