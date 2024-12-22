import { useState, useEffect } from "react";
import { Link, Unlink } from "lucide-react";

interface ImageDimensionsProps {
  file: File | null;
}

function ImageDimensions({ file }: ImageDimensionsProps) {
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number | null>(null);
  const [originalHeight, setOriginalHeight] = useState<number | null>(null);
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (file) {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.src = url;

      image.onload = () => {
        setOriginalWidth(image.width);
        setOriginalHeight(image.height);
        setWidth(image.width);
        setHeight(image.height);
        setOriginalAspectRatio(image.width / image.height);
        URL.revokeObjectURL(url);
      };
    } else {
      setWidth(null);
      setHeight(null);
      setOriginalWidth(null);
      setOriginalHeight(null);
      setOriginalAspectRatio(null);
    }
  }, [file]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = parseInt(e.target.value, 10);
    if (!isNaN(newWidth)) {
      setWidth(newWidth);
      if (keepAspectRatio && originalAspectRatio) {
        setHeight(Math.round(newWidth / originalAspectRatio));
      }
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = parseInt(e.target.value, 10);
    if (!isNaN(newHeight)) {
      setHeight(newHeight);
      if (keepAspectRatio && originalAspectRatio) {
        setWidth(Math.round(newHeight * originalAspectRatio));
      }
    }
  };

  const resetDimensions = () => {
    setWidth(originalWidth);
    setHeight(originalHeight);
  };

  const isReset = width === originalWidth && height === originalHeight;

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
                value={width ?? ""}
                onChange={handleWidthChange}
                placeholder="W"
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
                value={height ?? ""}
                onChange={handleHeightChange}
                placeholder="H"
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
                placeholder=""
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
                placeholder=""
                className="w-20 p-1 text-sm text-left bg-white cursor-not-allowed rounded-lg"
              />
            </div>
            <button
              onClick={() => setKeepAspectRatio(!keepAspectRatio)}
              className="flex items-center justify-center w-10 h-10 border rounded-lg bg-white shadow opacity-50 cursor-not-allowed"
              disabled
              aria-label={
                keepAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"
              }
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
