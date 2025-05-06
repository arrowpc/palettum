import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ImageTransparencyProps {
  file: File | null;
  isAdvancedMode: boolean;
  currentThreshold: number; // Current value from App state
  onThresholdChange: (value: number) => void; // Callback to update App state
}

const DEFAULT_TRANSPARENCY_THRESHOLD = 10; // Use 10 instead of 255 for basic mode when checked
const MAX_THRESHOLD = 255;

const ImageTransparency: React.FC<ImageTransparencyProps> = ({
  file,
  isAdvancedMode,
  currentThreshold,
  onThresholdChange,
}) => {
  const [controlEnabled, setControlEnabled] = useState(false); // If any control should be active
  const [isCheckedBasic, setIsCheckedBasic] = useState(false); // Checkbox state for basic mode

  // Effect to determine if transparency controls should be enabled at all
  useEffect(() => {
    if (!file) {
      setControlEnabled(false);
      setIsCheckedBasic(false);
      // Reset threshold in App state only if it wasn't already 0 when file is removed
      // This prevents resetting advanced slider value unnecessarily
      // if (currentThreshold !== 0) {
      //   onThresholdChange(0); // Default to 0 when no file
      // }
      return;
    }

    // Assume GIF can have transparency
    if (file.type === "image/gif") {
      setControlEnabled(true);
      // When file changes to GIF, sync basic checkbox state with current threshold
      setIsCheckedBasic(currentThreshold > 0);
      return;
    }

    // Check static images for actual alpha channel usage
    let revoked = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    const cleanup = () => {
      if (!revoked) {
        URL.revokeObjectURL(url);
        revoked = true;
      }
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Use smaller canvas for performance if image is large
      const MAX_CHECK_DIM = 512;
      const aspect = img.width / img.height;
      canvas.width = Math.min(img.width, MAX_CHECK_DIM);
      canvas.height = Math.min(img.height, Math.round(MAX_CHECK_DIM / aspect));

      const ctx = canvas.getContext("2d", { willReadFrequently: true }); // Hint for performance

      if (!ctx) {
        setControlEnabled(false);
        cleanup();
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let hasAlpha = false;
        // Check only alpha channel (every 4th value starting from index 3)
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            hasAlpha = true;
            break;
          }
        }
        setControlEnabled(hasAlpha);
        // If image has no alpha, ensure threshold is 0 and basic checkbox is off
        if (!hasAlpha) {
          setIsCheckedBasic(false);
          if (currentThreshold !== 0) {
            onThresholdChange(0);
          }
        } else {
          // If image has alpha, sync basic checkbox state
          setIsCheckedBasic(currentThreshold > 0);
        }
        cleanup();
      } catch (error) {
        // CORS or other errors reading image data
        console.error(
          "Error reading image data for transparency check:",
          error,
        );
        setControlEnabled(false); // Disable control if we can't check
        cleanup();
      }
    };

    img.onerror = () => {
      console.error("Error loading image for transparency check.");
      setControlEnabled(false);
      cleanup();
    };

    // Cleanup function for useEffect
    return cleanup;
  }, [file]); // Rerun only when file changes

  // Effect to manage threshold when switching modes or controlEnabled changes
  useEffect(() => {
    if (!controlEnabled) {
      // If controls become disabled, force threshold to 0
      if (currentThreshold !== 0) {
        onThresholdChange(0);
      }
      setIsCheckedBasic(false);
      return;
    }

    // When switching TO basic mode, set threshold based on checkbox
    if (!isAdvancedMode) {
      onThresholdChange(isCheckedBasic ? DEFAULT_TRANSPARENCY_THRESHOLD : 0);
    }
    // When switching TO advanced mode, the currentThreshold (potentially from basic mode)
    // is already set in App.tsx and will be used by the slider. No change needed here.
  }, [isAdvancedMode, controlEnabled, isCheckedBasic, onThresholdChange]);

  // Handler for basic mode checkbox
  const handleCheckedChangeBasic = useCallback(
    (checked: boolean) => {
      setIsCheckedBasic(checked);
      // Update threshold immediately based on new checkbox state
      onThresholdChange(checked ? DEFAULT_TRANSPARENCY_THRESHOLD : 0);
    },
    [onThresholdChange],
  );

  // Handler for advanced mode slider
  const handleSliderChangeAdvanced = useCallback(
    (value: number[]) => {
      onThresholdChange(value[0]);
    },
    [onThresholdChange],
  );

  const commonLabel = "Preserve Transparency";
  const commonDescription = isAdvancedMode
    ? "Pixels with alpha below threshold won't be palettified."
    : "Transparent pixels will not be palettified.";

  return (
    <div className="space-y-3">
      {!isAdvancedMode ? (
        // Basic Mode: Checkbox
        <div className="flex items-start space-x-3">
          <Checkbox
            id="transparency-basic"
            checked={isCheckedBasic}
            onCheckedChange={handleCheckedChangeBasic}
            disabled={!controlEnabled}
            className="mt-1"
          />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="transparency-basic"
              className={`text-lg font-medium ${!controlEnabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
                }`}
            >
              {commonLabel}
            </Label>
            <p
              className={`text-xs text-foreground-secondary ${!controlEnabled ? "opacity-50" : ""
                }`}
            >
              {commonDescription}
            </p>
          </div>
        </div>
      ) : (
        // Advanced Mode: Slider (only if controlEnabled)
        <div className={`space-y-2 ${!controlEnabled ? "opacity-50" : ""}`}>
          <div className="flex justify-between items-center">
            <Label
              htmlFor="transparency-slider"
              className={`text-lg font-medium ${!controlEnabled ? "cursor-not-allowed" : ""
                }`}
            >
              Transparency Threshold (
              {controlEnabled ? currentThreshold : "N/A"})
            </Label>
          </div>
          <Slider
            id="transparency-slider"
            min={0}
            max={MAX_THRESHOLD}
            step={1}
            value={[controlEnabled ? currentThreshold : 0]}
            onValueChange={handleSliderChangeAdvanced}
            disabled={!controlEnabled}
          />
          <p className="text-xs text-foreground-secondary">
            {commonDescription} (0 = off)
            {!controlEnabled && file && " (Image has no transparency)"}
            {!controlEnabled && !file && " (Upload an image)"}
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageTransparency;
