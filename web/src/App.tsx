import { useState, useCallback } from "react";
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
  MAPPING_SMOOTHED_PALETTIZED,
  FORMULA_CIEDE2000,
  SMOOTHING_STYLE_IDW,
  DEFAULT_DITHERING_STYLE,
  DEFAULT_DITHERING_STRENGTH,
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

if (import.meta.env.MODE === "development") {
  import("react-scan").then(({ scan }) => {
    scan({ enabled: false });
  });
}

const DEFAULT_MAPPING: MappingKey = MAPPING_PALETTIZED;
const DEFAULT_FORMULA: FormulaKey = FORMULA_CIEDE2000;
const DEFAULT_SMOOTHING_STYLE: SmoothingStyleKey = SMOOTHING_STYLE_IDW;
const DEFAULT_TRANSPARENCY_THRESHOLD = 0;
const DEFAULT_LAB_SCALES: [number, number, number] = [1.0, 1.0, 1.0];
const DEFAULT_SMOOTHING_STRENGTH = 0.5;
const HARDCODED_QUANT_LEVEL = 0;

const MAPPING_OPTIONS: MappingKey[] = [
  MAPPING_PALETTIZED,
  MAPPING_SMOOTHED,
  MAPPING_SMOOTHED_PALETTIZED,
];
const MAPPING_NAMES: Record<MappingKey, string> = {
  [MAPPING_PALETTIZED]: "Snap to Palette",
  [MAPPING_SMOOTHED]: "Color Blend",
  [MAPPING_SMOOTHED_PALETTIZED]: "Blend then Snap",
};
const MAPPING_TOOLTIPS: Record<MappingKey, string> = {
  [MAPPING_PALETTIZED]: "Match each pixel to closest palette color",
  [MAPPING_SMOOTHED]: "Blend colors based on distance weighting",
  [MAPPING_SMOOTHED_PALETTIZED]: "Blend colors first, then match to palette",
};

function App() {
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
  const [labScales, setLabScales] =
    useState<[number, number, number]>(DEFAULT_LAB_SCALES);
  const [smoothingStrength, setSmoothingStrength] = useState<number>(
    DEFAULT_SMOOTHING_STRENGTH,
  );

  const [ditheringStyle, setDitheringStyle] = useState<DitheringKey>(
    DEFAULT_DITHERING_STYLE,
  );
  const [ditheringStrength, setDitheringStrength] = useState<number>(
    DEFAULT_DITHERING_STRENGTH,
  );

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

  const handleLabScalesChange = useCallback(
    (newScales: [number, number, number]) => {
      setLabScales(newScales);
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

  const renderColorMappingMethod = () => (
    <div className="space-y-3">
      <Label className="text-lg font-medium text-foreground">
        Color Mapping Method
      </Label>
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
            Map images & GIFs to a custom palette
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
            currentLabScales={labScales}
            currentSmoothingStrength={smoothingStrength}
            currentDitheringStyle={ditheringStyle}
            currentDitheringStrength={ditheringStrength}
            onMappingChange={handleMappingChange}
            onFormulaChange={handleFormulaChange}
            onSmoothingStyleChange={handleSmoothingStyleChange}
            onThresholdChange={handleThresholdChange}
            onLabScalesChange={handleLabScalesChange}
            onSmoothingStrengthChange={handleSmoothingStrengthChange}
            onDitheringStyleChange={handleDitheringStyleChange}
            onDitheringStrengthChange={handleDitheringStrengthChange}
          />

          <PalettifyImage
            file={uploadedFile}
            dimensions={dimensions}
            palette={selectedPalette}
            transparentThreshold={transparentThreshold}
            mapping={mapping}
            quantLevel={HARDCODED_QUANT_LEVEL}
            formula={formula}
            smoothingStyle={smoothingStyle}
            labScales={labScales}
            smoothingStrength={smoothingStrength}
            ditheringStyle={ditheringStyle}
            ditheringStrength={ditheringStrength}
          />
        </div>

        <Footer />
      </div>
      <Toaster richColors position="bottom-center" />
    </>
  );
}

export default App;
