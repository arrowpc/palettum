import React, { useState, useEffect, useCallback, useRef } from "react";
import { RotateCcw, Link2, Unlink2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useMediaStore } from "@/stores/media";
import { useConfigStore } from "@/stores/config";

interface DraggableDimensionLabelProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  children: React.ReactNode;
}

const DraggableDimensionLabel = ({
  id,
  value,
  onChange,
  className,
  children,
}: DraggableDimensionLabelProps) => {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startValue = useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    startX.current = e.clientX;
    startValue.current = parseInt(value) || 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaX = e.clientX - startX.current;
    const newValue = Math.round(startValue.current + deltaX);
    const syntheticEvent = {
      target: { value: String(newValue), id },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <span
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        cursor: dragging ? "ew-resize" : "col-resize",
        userSelect: "none",
      }}
    >
      {children}
    </span>
  );
};

export const Dimensions: React.FC = () => {
  const { resizedWidth, resizedHeight, setResizedDims, meta } =
    useMediaStore();
  const setConfig = useConfigStore((s) => s.setConfig);

  const [dimensions, setDimensions] = useState({
    width: "",
    height: "",
    originalWidth: null as number | null,
    originalHeight: null as number | null,
    lockedAspectRatio: null as number | null,
  });
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);

  useEffect(() => {
    if (!meta) {
      setDimensions({
        width: "",
        height: "",
        originalWidth: null,
        originalHeight: null,
        lockedAspectRatio: null,
      });
      return;
    }
    const w = resizedWidth > 0 ? resizedWidth : meta.width;
    const h = resizedHeight > 0 ? resizedHeight : meta.height;
    setDimensions({
      width: String(w),
      height: String(h),
      originalWidth: meta.width,
      originalHeight: meta.height,
      lockedAspectRatio: keepAspectRatio ? meta.width / meta.height : null,
    });
  }, [meta]);

  useEffect(() => {
    if (meta && resizedWidth === 0 && resizedHeight === 0) {
      setResizedDims(meta.width, meta.height);
      setConfig("resizeWidth", meta.width);
      setConfig("resizeHeight", meta.height);
    }
  }, [meta, resizedWidth, resizedHeight]);

  const clampDimension = (n: number): number =>
    Math.min(Math.max(1, n), 4096);

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      const num = raw === "" ? null : parseInt(raw, 10);
      let newW = raw;
      let newH = dimensions.height;

      if (num != null) {
        const cw = clampDimension(num);
        newW = String(cw);
        if (keepAspectRatio && dimensions.lockedAspectRatio) {
          const calcH = Math.round(cw / dimensions.lockedAspectRatio);
          newH = String(clampDimension(calcH));
        }
      }

      setDimensions((d) => ({
        ...d,
        width: newW,
        height: newH,
      }));

      if (num != null && num > 0) {
        if (keepAspectRatio && dimensions.lockedAspectRatio) {
          const wNum = parseInt(newW, 10);
          const hNum = parseInt(newH, 10);
          setResizedDims(wNum, hNum);
          setConfig("resizeWidth", wNum);
          setConfig("resizeHeight", hNum);
        } else {
          setResizedDims(parseInt(newW, 10), resizedHeight);
          setConfig("resizeWidth", parseInt(newW, 10));
        }
      }
    },
    [dimensions, keepAspectRatio, resizedHeight]
  );

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      const num = raw === "" ? null : parseInt(raw, 10);
      let newH = raw;
      let newW = dimensions.width;

      if (num != null) {
        const ch = clampDimension(num);
        newH = String(ch);
        if (keepAspectRatio && dimensions.lockedAspectRatio) {
          const calcW = Math.round(ch * dimensions.lockedAspectRatio);
          newW = String(clampDimension(calcW));
        }
      }

      setDimensions((d) => ({
        ...d,
        width: newW,
        height: newH,
      }));

      if (num != null && num > 0) {
        if (keepAspectRatio && dimensions.lockedAspectRatio) {
          const wNum = parseInt(newW, 10);
          const hNum = parseInt(newH, 10);
          setResizedDims(wNum, hNum);
          setConfig("resizeWidth", wNum);
          setConfig("resizeHeight", hNum);
        } else {
          setResizedDims(resizedWidth, parseInt(newH, 10));
          setConfig("resizeHeight", parseInt(newH, 10));
        }
      }
    },
    [dimensions, keepAspectRatio, resizedWidth]
  );

  const resetDimensions = useCallback(() => {
    const ow = dimensions.originalWidth;
    const oh = dimensions.originalHeight;
    if (ow != null && oh != null) {
      setDimensions((d) => ({
        ...d,
        width: String(ow),
        height: String(oh),
        lockedAspectRatio: keepAspectRatio ? ow / oh : null,
      }));
      setResizedDims(ow, oh);
      setConfig("resizeWidth", ow);
      setConfig("resizeHeight", oh);
    }
  }, [dimensions.originalWidth, dimensions.originalHeight, keepAspectRatio]);

  const toggleAspectRatio = useCallback(() => {
    setKeepAspectRatio((prev) => {
      const next = !prev;
      setDimensions((d) => {
        const wNum = parseInt(d.width, 10);
        const hNum = parseInt(d.height, 10);
        const valid = !isNaN(wNum) && !isNaN(hNum) && hNum !== 0;
        return {
          ...d,
          lockedAspectRatio: next && valid ? wNum / hNum : null,
        };
      });
      return next;
    });
  }, []);

  const isReset =
    !meta ||
    (parseInt(dimensions.width, 10) === dimensions.originalWidth &&
      parseInt(dimensions.height, 10) === dimensions.originalHeight);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between w-fit mx-auto">
        <label className="text-lg font-medium">Dimensions</label>
        <button
          onClick={resetDimensions}
          disabled={isReset}
          aria-label="Reset dimensions"
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full ml-4",
            "text-foreground-secondary transition-colors",
            isReset
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-secondary hover:text-foreground"
          )}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center border border-foreground rounded-md h-10">
          <DraggableDimensionLabel
            id="width"
            value={dimensions.width}
            onChange={handleWidthChange}
            className="flex items-center justify-center text-sm font-medium text-foreground px-3 h-full"
          >
            W
          </DraggableDimensionLabel>
          <div className="w-px h-6 bg-foreground" />
          <Input
            id="width"
            type="number"
            value={dimensions.width}
            onChange={handleWidthChange}
            min="1"
            max={4096}
            placeholder="Width"
            className="w-20 h-full px-3 text-sm border-0 focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center border border-foreground rounded-md h-10">
          <DraggableDimensionLabel
            id="height"
            value={dimensions.height}
            onChange={handleHeightChange}
            className="flex items-center justify-center text-sm font-medium text-foreground px-3 h-full"
          >
            H
          </DraggableDimensionLabel>
          <div className="w-px h-6 bg-foreground" />
          <Input
            id="height"
            type="number"
            value={dimensions.height}
            onChange={handleHeightChange}
            min="1"
            max={4096}
            placeholder="Height"
            className="w-20 h-full px-3 text-sm border-0 focus-visible:ring-0"
          />
        </div>

        <button
          onClick={toggleAspectRatio}
          aria-label={
            keepAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"
          }
          className={cn(
            "flex items-center justify-center w-10 h-10 border rounded-md shadow-sm focus:outline-none transition-all",
            keepAspectRatio
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary-hover"
              : "text-foreground border-foreground hover:bg-secondary-hover"
          )}
        >
          {keepAspectRatio ? (
            <Link2 size={20} className="text-foreground" />
          ) : (
            <Unlink2 size={20} className="text-icon-inactive" />
          )}
        </button>
      </div>
    </div>
  );
};
