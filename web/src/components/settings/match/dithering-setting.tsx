import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConfigStore } from "@/stores";
import SettingItemWrapper from "../setting-item-wrapper";
import React from "react";

function DitheringSetting() {
  const ditherAlgorithm = useConfigStore((state) => state.config.ditherAlgorithm);
  const ditherStrength = useConfigStore((state) => state.config.ditherStrength);
  const setConfig = useConfigStore((state) => state.setConfig);

  const isDitheringEnabled = ditherAlgorithm !== "None";

  const handleCheckedChange = (checked: boolean) => {
    if (checked) {
      setConfig("ditherAlgorithm", "Bn");
      if (ditherStrength === 0) {
        setConfig("ditherStrength", 0.5);
      }
    } else {
      setConfig("ditherAlgorithm", "None");
      setConfig("ditherStrength", 0);
    }
  };

  return (
    <SettingItemWrapper
      label="Dithering"
      control={
        <Switch
          id="dithering-switch"
          checked={isDitheringEnabled}
          onCheckedChange={handleCheckedChange}
        />
      }
    >
      <Slider
        value={[isDitheringEnabled ? ditherStrength ?? 0 : 0]}
        max={1}
        step={0.01}
        onValueChange={([v]) => {
          setConfig("ditherStrength", v);
          if (v === 0) {
            setConfig("ditherAlgorithm", "None");
          } else if (ditherAlgorithm === "None" && v > 0) {
            setConfig("ditherAlgorithm", "Bn");
          }
        }}
        className="w-full"
      />
      <div
        className={`text-center text-sm ${(ditherStrength ?? 0) === 0 ? "text-muted-foreground" : ""}`}
      >
        {(ditherStrength ?? 0) === 0 ? "Off" : (ditherStrength ?? 0).toFixed(2)}
      </div>
    </SettingItemWrapper>
  );
}

export default React.memo(DitheringSetting);
