import { useState, useEffect, useCallback } from "react";
import { Link, Unlink } from "lucide-react";

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
      });
      onChange(null, null);
      return;
    }

    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      setDimensions({
        width: String(image.width),
        height: String(image.height),
        originalWidth: image.width,
        originalHeight: image.height,
        originalAspectRatio: image.width / image.height,
      });
      onChange(image.width, image.height);
      URL.revokeObjectURL(url);
    };

    image.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, onChange]);

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numericValue = value === "" ? null : parseInt(value, 10);

      if (value === "" || (!isNaN(numericValue!) && numericValue! >= 0)) {
        let newHeight = dimensions.height;
        if (
          value !== "" &&
          keepAspectRatio &&
          dimensions.originalAspectRatio &&
          numericValue
        ) {
          const newHeightNum = Math.round(
            numericValue / dimensions.originalAspectRatio,
          );
          newHeight = String(newHeightNum);
        }

        setDimensions((prev) => ({
          ...prev,
          width: value,
          height: newHeight,
        }));

        if (typeof onChange === "function") {
          const widthVal = value === "" ? null : parseInt(value, 10);
          const heightVal = newHeight === "" ? null : parseInt(newHeight, 10);
          onChange(widthVal, heightVal);
        }
      }
    },
    [
      dimensions.originalAspectRatio,
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
        if (
          value !== "" &&
          keepAspectRatio &&
          dimensions.originalAspectRatio &&
          numericValue
        ) {
          const newWidthNum = Math.round(
            numericValue * dimensions.originalAspectRatio,
          );
          newWidth = String(newWidthNum);
        }

        setDimensions((prev) => ({
          ...prev,
          width: newWidth,
          height: value,
        }));

        if (typeof onChange === "function") {
          const widthVal = newWidth === "" ? null : parseInt(newWidth, 10);
          const heightVal = value === "" ? null : parseInt(value, 10);
          onChange(widthVal, heightVal);
        }
      }
    },
    [
      dimensions.originalAspectRatio,
      dimensions.width,
      keepAspectRatio,
      onChange,
    ],
  );
  const resetDimensions = useCallback(() => {
    if (dimensions.originalWidth && dimensions.originalHeight) {
      const newDimensions = {
        ...dimensions,
        width: String(dimensions.originalWidth),
        height: String(dimensions.originalHeight),
      };
      setDimensions(newDimensions);
      onChange(dimensions.originalWidth, dimensions.originalHeight);
    }
  }, [dimensions, onChange]);

  const isReset =
    parseInt(dimensions.width) === dimensions.originalWidth &&
    parseInt(dimensions.height) === dimensions.originalHeight;

  return (
    <div>
      <div className="flex items-center space-x-1">
        <h3 className="text-lg font-medium text-gray-800">Dimensions</h3>
        <button
          onClick={resetDimensions}
          className={`flex items-center justify-center w-[calc(1em+1rem)] h-[calc(1em+1rem)] rounded-full bg-white text-gray-600 hover:bg-gray-100 focus:outline-none transition-all ${isReset ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"
            }`}
          aria-label="Reset dimensions"
          disabled={isReset}
        >
          <span className="text-xl">↻</span>
        </button>
      </div>

      {file ? (
        <div className="mt-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-white shadow px-2 py-1 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
              <label htmlFor="width" className="text-gray-600 mr-2">
                W
              </label>
              <input
                id="width"
                type="number"
                value={dimensions.width}
                onChange={handleWidthChange}
                min="1"
                placeholder="Width"
                className="w-20 p-1 text-sm text-left focus:outline-none bg-white rounded-lg overflow-hidden text-ellipsis"
              />
            </div>
            <div className="flex items-center bg-white shadow px-2 py-1 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
              <label htmlFor="height" className="text-gray-600 mr-2">
                H
              </label>
              <input
                id="height"
                type="number"
                value={dimensions.height}
                onChange={handleHeightChange}
                min="1"
                placeholder="Height"
                className="w-20 p-1 text-sm text-left focus:outline-none bg-white rounded-lg overflow-hidden text-ellipsis"
              />
            </div>
            <button
              onClick={() => setKeepAspectRatio(!keepAspectRatio)}
              className={`flex items-center justify-center w-10 h-10 border rounded-lg shadow focus:outline-none transition-all ${keepAspectRatio
                  ? "bg-blue-500 hover:bg-blue-600 border-blue-500"
                  : "bg-white hover:bg-blue-50"
                }`}
              aria-label={
                keepAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"
              }
            >
              {keepAspectRatio ? (
                <Link size={20} className="text-white" />
              ) : (
                <Unlink size={20} className="text-gray-500" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center space-x-4 opacity-50 cursor-not-allowed">
            <div className="flex items-center bg-white shadow px-2 py-1 rounded-lg">
              <label htmlFor="width" className="text-gray-600 mr-2">
                W
              </label>
              <input
                id="width"
                type="number"
                disabled
                value=""
                placeholder="Width"
                className="w-20 p-1 text-sm text-left bg-white cursor-not-allowed rounded-lg"
              />
            </div>
            <div className="flex items-center bg-white shadow px-2 py-1 rounded-lg">
              <label htmlFor="height" className="text-gray-600 mr-2">
                H
              </label>
              <input
                id="height"
                type="number"
                disabled
                value=""
                placeholder="Height"
                className="w-20 p-1 text-sm text-left bg-white cursor-not-allowed rounded-lg"
              />
            </div>
            <button
              className="flex items-center justify-center w-10 h-10 border rounded-lg bg-white shadow opacity-50 cursor-not-allowed"
              disabled
              aria-label="Lock aspect ratio"
            >
              <Unlink className="text-gray-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageDimensions;
