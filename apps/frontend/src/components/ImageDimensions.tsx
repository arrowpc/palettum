import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Link, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 7680;

interface ImageDimensionsProps {
  file: File | null;
  onChange: (width: number | null, height: number | null) => void;
}

function ImageDimensions({ file, onChange }: ImageDimensionsProps) {
  const [dimensions, setDimensions] = useState({
    width: "",
    height: "",
    originalWidth: null as number | null,
    originalHeight: null as number | null,
    originalAspectRatio: null as number | null,
    currentAspectRatio: null as number | null,
  });
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);

  useEffect(() => {
    if (!file) {
      setDimensions({
        width: "",
        height: "",
        originalWidth: null,
        originalHeight: null,
        originalAspectRatio: null,
        currentAspectRatio: null,
      });
      onChange(null, null);
      return;
    }

    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const aspectRatio = image.width / image.height;
      setDimensions({
        width: String(image.width),
        height: String(image.height),
        originalWidth: image.width,
        originalHeight: image.height,
        originalAspectRatio: aspectRatio,
        currentAspectRatio: aspectRatio,
      });
      onChange(image.width, image.height);
      URL.revokeObjectURL(url);
    };

    image.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, onChange]);

  useEffect(() => {
    const widthNum = dimensions.width ? parseInt(dimensions.width, 10) : null;
    const heightNum = dimensions.height
      ? parseInt(dimensions.height, 10)
      : null;

    if (widthNum && heightNum && widthNum > 0 && heightNum > 0) {
      setDimensions((prev) => ({
        ...prev,
        currentAspectRatio: widthNum / heightNum,
      }));
    }
  }, [dimensions.width, dimensions.height]);

  const clampDimension = (value: number): number => {
    return Math.min(Math.max(1, value), MAX_DIMENSION);
  };

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numericValue = value === "" ? null : parseInt(value, 10);

      if (value === "" || (!isNaN(numericValue!) && numericValue! >= 0)) {
        let newWidth = value;
        let newHeight = dimensions.height;

        if (numericValue !== null) {
          const clampedWidth = clampDimension(numericValue);
          newWidth = String(clampedWidth);

          if (
            keepAspectRatio &&
            dimensions.currentAspectRatio &&
            dimensions.height
          ) {
            const calculatedHeight = Math.round(
              clampedWidth / dimensions.currentAspectRatio,
            );
            const clampedHeight = clampDimension(calculatedHeight);

            if (calculatedHeight !== clampedHeight) {
              const recalculatedWidth = Math.round(
                clampedHeight * dimensions.currentAspectRatio,
              );
              newWidth = String(clampDimension(recalculatedWidth));
            }

            newHeight = String(clampedHeight);
          }
        }

        setDimensions((prev) => ({
          ...prev,
          width: newWidth,
          height: newHeight,
        }));

        onChange(
          newWidth === "" ? null : parseInt(newWidth, 10),
          newHeight === "" ? null : parseInt(newHeight, 10),
        );
      }
    },
    [
      dimensions.currentAspectRatio,
      dimensions.height,
      keepAspectRatio,
      onChange,
    ],
  );

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numericValue = value === "" ? null : parseInt(value, 10);

      if (value === "" || (!isNaN(numericValue!) && numericValue! >= 0)) {
        let newWidth = dimensions.width;
        let newHeight = value;

        if (numericValue !== null) {
          const clampedHeight = clampDimension(numericValue);
          newHeight = String(clampedHeight);

          if (
            keepAspectRatio &&
            dimensions.currentAspectRatio &&
            dimensions.width
          ) {
            const calculatedWidth = Math.round(
              clampedHeight * dimensions.currentAspectRatio,
            );
            const clampedWidth = clampDimension(calculatedWidth);

            if (calculatedWidth !== clampedWidth) {
              const recalculatedHeight = Math.round(
                clampedWidth / dimensions.currentAspectRatio,
              );
              newHeight = String(clampDimension(recalculatedHeight));
            }

            newWidth = String(clampedWidth);
          }
        }

        setDimensions((prev) => ({
          ...prev,
          width: newWidth,
          height: newHeight,
        }));

        onChange(
          newWidth === "" ? null : parseInt(newWidth, 10),
          newHeight === "" ? null : parseInt(newHeight, 10),
        );
      }
    },
    [
      dimensions.currentAspectRatio,
      dimensions.width,
      keepAspectRatio,
      onChange,
    ],
  );

  const resetDimensions = useCallback(() => {
    if (dimensions.originalWidth && dimensions.originalHeight) {
      setDimensions((prev) => ({
        ...prev,
        width: String(dimensions.originalWidth),
        height: String(dimensions.originalHeight),
        currentAspectRatio: dimensions.originalAspectRatio,
      }));
      onChange(dimensions.originalWidth, dimensions.originalHeight);
    }
  }, [dimensions.originalWidth, dimensions.originalHeight, onChange]);

  const isReset =
    !file ||
    (parseInt(dimensions.width) === dimensions.originalWidth &&
      parseInt(dimensions.height) === dimensions.originalHeight);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numericValue = value === "" ? null : parseInt(value, 10);

      if (numericValue !== null) {
        if (e.target.id === "width") {
          handleWidthChange({
            target: { value: String(numericValue) },
          } as React.ChangeEvent<HTMLInputElement>);
        } else {
          handleHeightChange({
            target: { value: String(numericValue) },
          } as React.ChangeEvent<HTMLInputElement>);
        }
      }
    },
    [handleWidthChange, handleHeightChange],
  );

  return (
    <div>
      <div className="flex items-center space-x-2">
        <h3 className="text-lg font-medium text-foreground">Dimensions</h3>
        <button
          onClick={resetDimensions}
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full",
            "text-foreground-secondary transition-colors",
            isReset
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-secondary hover:text-foreground",
          )}
          aria-label="Reset dimensions"
          disabled={isReset}
        >
          <RotateCcw size={20} />
        </button>
      </div>
      {file ? (
        <div className="mt-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-background border border-border rounded-md shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-border-active">
              <label
                htmlFor="width"
                className="text-base text-foreground-secondary px-3 py-2"
              >
                W
              </label>
              <input
                id="width"
                type="number"
                value={dimensions.width}
                onChange={handleWidthChange}
                onBlur={handleBlur}
                min="1"
                max={MAX_DIMENSION}
                placeholder="Width"
                className="w-20 p-2 text-xs text-foreground focus:outline-none bg-background rounded-r-md"
              />
            </div>
            <div className="flex items-center bg-background border border-border rounded-md shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-border-active">
              <label
                htmlFor="height"
                className="text-base text-foreground-secondary px-3 py-2"
              >
                H
              </label>
              <input
                id="height"
                type="number"
                value={dimensions.height}
                onChange={handleHeightChange}
                onBlur={handleBlur}
                min="1"
                max={MAX_DIMENSION}
                placeholder="Height"
                className="w-20 p-2 text-xs text-foreground focus:outline-none bg-background rounded-r-md"
              />
            </div>
            <button
              onClick={() => setKeepAspectRatio(!keepAspectRatio)}
              className={cn(
                "flex items-center justify-center w-10 h-10 border rounded-md shadow-sm focus:outline-none transition-all",
                keepAspectRatio
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary-hover"
                  : "text-foreground border-border hover:bg-secondary-hover",
              )}
              aria-label={
                keepAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"
              }
            >
              {keepAspectRatio ? (
                <Link size={20} className="text-foreground" />
              ) : (
                <Unlink size={20} className="text-icon-inactive" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center space-x-4 opacity-60 cursor-not-allowed">
            <div className="flex items-center bg-input-disabled border border-border rounded-md shadow-sm">
              <label
                htmlFor="width"
                className="text-foreground-muted px-3 py-2"
              >
                W
              </label>
              <input
                id="width"
                type="number"
                disabled
                value=""
                placeholder="Width"
                className="w-20 p-2 text-xs text-foreground-muted bg-input-disabled cursor-not-allowed rounded-r-md"
              />
            </div>
            <div className="flex items-center bg-input-disabled border border-border rounded-md shadow-sm">
              <label
                htmlFor="height"
                className="text-foreground-muted px-3 py-2"
              >
                H
              </label>
              <input
                id="height"
                type="number"
                disabled
                value=""
                placeholder="Height"
                className="w-20 p-2 text-xs text-foreground-muted bg-input-disabled cursor-not-allowed rounded-r-md"
              />
            </div>
            <button
              className="flex items-center justify-center w-10 h-10 border rounded-md bg-input-disabled shadow-sm cursor-not-allowed"
              disabled
              aria-label="Lock aspect ratio"
            >
              <Unlink className="text-icon-disabled " />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageDimensions;
