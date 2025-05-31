import { useState, useEffect, useCallback } from "react";
import ImageUpload from "@/components/ImageUpload";
import ImageDimensions from "@/components/ImageDimensions";
import PaletteManager from "@/components/PaletteManager";
import PalettifyImage from "@/components/PalettifyImage";
import DarkModeToggle from "@/components/DarkModeToggle";
import GitHubButton from "@/components/GitHubButton";
import type { Palette } from "palettum";
import Footer from "@/components/Footer";
import AdjustmentsAccordion from "@/components/adjustments/AdjustmentsAccordion";
import {
  type MappingKey,
  type FormulaKey,
  type SmoothingStyleKey,
  type DitheringKey,
  MAPPING_PALETTIZED,
  MAPPING_SMOOTHED,
  FORMULA_CIEDE2000,
  SMOOTHING_STYLE_IDW,
  DEFAULT_DITHERING_STYLE,
  DEFAULT_DITHERING_STRENGTH,
  DEFAULT_QUANT_LEVEL,
  DEFAULT_FILTER,
  FilterKey,
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

if (import.meta.env.MODE === "development") {
  import("react-scan").then(({ scan }) => {
    scan({ enabled: false });
  });
}

const DEFAULT_MAPPING: MappingKey = MAPPING_SMOOTHED;
const DEFAULT_FORMULA: FormulaKey = FORMULA_CIEDE2000;
const DEFAULT_SMOOTHING_STYLE: SmoothingStyleKey = SMOOTHING_STYLE_IDW;
const DEFAULT_TRANSPARENCY_THRESHOLD = 128;
const DEFAULT_SMOOTHING_STRENGTH = 0.5;

const MAPPING_OPTIONS: MappingKey[] = [MAPPING_SMOOTHED, MAPPING_PALETTIZED];
const MAPPING_NAMES: Record<MappingKey, string> = {
  [MAPPING_SMOOTHED]: "Blend",
  [MAPPING_PALETTIZED]: "Match",
};
const MAPPING_TOOLTIPS: Record<MappingKey, string> = {
  [MAPPING_SMOOTHED]: "Blend colors based on distance weighting",
  [MAPPING_PALETTIZED]: "Match each pixel to closest palette color",
};

function App() {
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
  const [dimensions, setDimensions] = useState({
    width: null as number | null,
    height: null as number | null,
  });
  const [selectedPalette, setSelectedPalette] = useState<Palette>();

  const [transparentThreshold, setTransparentThreshold] = useState<number>(
    DEFAULT_TRANSPARENCY_THRESHOLD,
  );
  const [mapping, setMapping] = useState<MappingKey>(DEFAULT_MAPPING);
  const [formula, setFormula] = useState<FormulaKey>(DEFAULT_FORMULA);
  const [smoothingStyle, setSmoothingStyle] = useState<SmoothingStyleKey>(
    DEFAULT_SMOOTHING_STYLE,
  );
  const [smoothingStrength, setSmoothingStrength] = useState<number>(
    DEFAULT_SMOOTHING_STRENGTH,
  );
  const [quantLevel, setQuantLevel] = useState<number>(DEFAULT_QUANT_LEVEL);

  const [ditheringStyle, setDitheringStyle] = useState<DitheringKey>(
    DEFAULT_DITHERING_STYLE,
  );
  const [ditheringStrength, setDitheringStrength] = useState<number>(
    DEFAULT_DITHERING_STRENGTH,
  );
  const [filter, setFilter] = useState<FilterKey>(DEFAULT_FILTER);

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadedFile(file);
  }, []);

  const handleDimensionsChange = useCallback(
    (width: number | null, height: number | null) => {
      setDimensions({ width, height });
    },
    [],
  );

  const handlePaletteSelect = useCallback((palette: Palette) => {
    setSelectedPalette(palette);
  }, []);

  const handleThresholdChange = useCallback((newThreshold: number) => {
    setTransparentThreshold(newThreshold);
  }, []);

  const handleMappingChange = useCallback((newMapping: MappingKey) => {
    setMapping(newMapping);
  }, []);

  const handleFormulaChange = useCallback((newFormula: FormulaKey) => {
    setFormula(newFormula);
  }, []);

  const handleSmoothingStyleChange = useCallback(
    (newStyle: SmoothingStyleKey) => {
      setSmoothingStyle(newStyle);
    },
    [],
  );

  const handleSmoothingStrengthChange = useCallback((s: number) => {
    setSmoothingStrength(s);
  }, []);

  const handleDitheringStyleChange = useCallback((newStyle: DitheringKey) => {
    setDitheringStyle(newStyle);
  }, []);

  const handleDitheringStrengthChange = useCallback((newStrength: number) => {
    setDitheringStrength(newStrength);
  }, []);

  const handleQuantLevelChange = useCallback((newLevel: number) => {
    setQuantLevel(newLevel);
  }, []);

  const handleFilterChange = useCallback((newFilter: FilterKey) => {
    setFilter(newFilter);
  }, []);

  const renderColorMappingMethod = () => (
    <div className="space-y-3">
      <Label className="text-lg font-medium text-foreground">Style</Label>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-2">
          {MAPPING_OPTIONS.map((option) => (
            <Tooltip key={option}>
              <TooltipTrigger asChild>
                <Button
                  variant={mapping === option ? "default" : "outline"}
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

          <AdjustmentsAccordion
            file={uploadedFile}
            currentMapping={mapping}
            currentFormula={formula}
            currentSmoothingStyle={smoothingStyle}
            currentThreshold={transparentThreshold}
            currentSmoothingStrength={smoothingStrength}
            currentDitheringStyle={ditheringStyle}
            currentDitheringStrength={ditheringStrength}
            currentQuantLevel={quantLevel}
            currentFilter={filter}
            onMappingChange={handleMappingChange}
            onFormulaChange={handleFormulaChange}
            onSmoothingStyleChange={handleSmoothingStyleChange}
            onThresholdChange={handleThresholdChange}
            onSmoothingStrengthChange={handleSmoothingStrengthChange}
            onDitheringStyleChange={handleDitheringStyleChange}
            onDitheringStrengthChange={handleDitheringStrengthChange}
            onQuantLevelChange={handleQuantLevelChange}
            onFilterChange={handleFilterChange}
          />

          <PalettifyImage
            file={uploadedFile}
            dimensions={dimensions}
            palette={selectedPalette}
            transparentThreshold={transparentThreshold}
            mapping={mapping}
            quantLevel={quantLevel}
            formula={formula}
            smoothingStyle={smoothingStyle}
            smoothingStrength={smoothingStrength}
            ditheringStyle={ditheringStyle}
            ditheringStrength={ditheringStrength}
            filter={filter}
          />
        </div>

        <Footer />
      </div>
      <Toaster richColors position="bottom-center" />
    </>
  );
}

export default App;
