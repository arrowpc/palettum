import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConfigStore, useMediaStore } from "@/stores";
import SettingWrapper from "../setting-wrapper";
import React from "react";

function Transparency() {
  const transparencyThreshold = useConfigStore(
    (state) => state.config.transparencyThreshold,
  );
  const setConfig = useConfigStore((state) => state.setConfig);
  const hasAlpha = useMediaStore((state) => state.hasAlpha);

  // Force transparencyThreshold to 0 if no alpha is detected
  React.useEffect(() => {
    if (!hasAlpha && transparencyThreshold !== 0) {
      setConfig("transparencyThreshold", 0);
    }
  }, [hasAlpha, transparencyThreshold, setConfig]);

  const isTransparencyEnabled = (transparencyThreshold ?? 0) > 0;

  const handleCheckedChange = (checked: boolean) => {
    if (checked) {
      if (transparencyThreshold === 0) {
        setConfig("transparencyThreshold", 128);
      }
    } else {
      setConfig("transparencyThreshold", 0);
    }
  };

  return (
    <SettingWrapper
      label="Transparency"
      control={
        <Switch
          id="transparency-switch"
          checked={isTransparencyEnabled && hasAlpha}
          onCheckedChange={handleCheckedChange}
          disabled={!hasAlpha}
        />
      }
    >
      {hasAlpha ? (
        <>
          <Slider
            value={[transparencyThreshold ?? 0]}
            max={255}
            step={1}
            onValueChange={([v]) => {
              setConfig("transparencyThreshold", v);
            }}
            className="w-full"
            disabled={!hasAlpha}
          />
          <div
            className={`text-center text-sm ${transparencyThreshold === 0 ? "text-muted-foreground" : ""}`}
          >
            {transparencyThreshold === 0 ? "Off" : transparencyThreshold}
          </div>
        </>
      ) : (
        <div className="text-center text-sm text-muted-foreground">
          No Alpha detected in media
        </div>
      )}
    </SettingWrapper>
  );
}

export default React.memo(Transparency);
