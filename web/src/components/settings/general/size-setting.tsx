import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SettingItemWrapper from "@/components/settings/setting-item-wrapper";
import { useMediaStore } from "@/stores/media";
import { useConfigStore } from "@/stores/config";

export const SizeSetting: React.FC = () => {
  const {
    resizedWidth,
    resizedHeight,
    setResizedDims,
    meta,
  } = useMediaStore();
  const setConfig = useConfigStore((s) => s.setConfig);

  const [width, setWidth] = useState<string>(() =>
    resizedWidth > 0
      ? resizedWidth.toString()
      : meta?.width != null
      ? meta.width.toString()
      : ""
  );
  const [height, setHeight] = useState<string>(() =>
    resizedHeight > 0
      ? resizedHeight.toString()
      : meta?.height != null
      ? meta.height.toString()
      : ""
  );

  useEffect(() => {
    if (meta && resizedWidth === 0 && resizedHeight === 0) {
      setResizedDims(meta.width, meta.height);
      setConfig("resizeWidth", meta.width);
      setConfig("resizeHeight", meta.height);
    }
  }, [meta, resizedWidth, resizedHeight, setResizedDims, setConfig]);

    useEffect(() => {
    if (meta) {
      if (!width) setWidth(meta.width.toString());
      if (!height) setHeight(meta.height.toString());
    }
  }, [meta]);

    useEffect(() => {
    if (
      resizedWidth > 0 &&
      parseInt(width, 10) !== resizedWidth
    ) {
      setWidth(resizedWidth.toString());
    }
    if (
      resizedHeight > 0 &&
      parseInt(height, 10) !== resizedHeight
    ) {
      setHeight(resizedHeight.toString());
    }
  }, [resizedWidth, resizedHeight]);

  const handleWidthChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value.replace(/\D/g, "");
    setWidth(val);
    const w = parseInt(val, 10);
    if (!isNaN(w) && w > 0) {
      setResizedDims(w, resizedHeight);
      setConfig("resizeWidth", w);
    }
  };

  const handleHeightChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value.replace(/\D/g, "");
    setHeight(val);
    const h = parseInt(val, 10);
    if (!isNaN(h) && h > 0) {
      setResizedDims(resizedWidth, h);
      setConfig("resizeHeight", h);
    }
  };

  return (
    <SettingItemWrapper label="Dimensions">
      <div className="flex items-center space-x-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="width">Width</Label>
          <Input
            id="width"
            type="number"
            value={width}
            placeholder="Auto"
            min="1"
            onChange={handleWidthChange}
          />
        </div>
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="height">Height</Label>
          <Input
            id="height"
            type="number"
            value={height}
            placeholder="Auto"
            min="1"
            onChange={handleHeightChange}
          />
        </div>
      </div>
    </SettingItemWrapper>
  );
};
