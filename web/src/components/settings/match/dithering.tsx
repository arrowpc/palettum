import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConfigStore } from "@/stores";
import React from "react";

function Dithering() {
  const ditherAlgorithm = useConfigStore(
    (state) => state.config.ditherAlgorithm,
  );
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between">
        <label className="text-lg font-medium">Dithering</label>
        <Switch
          id="dithering-switch"
          checked={isDitheringEnabled}
          onCheckedChange={handleCheckedChange}
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <Slider
          value={[isDitheringEnabled ? (ditherStrength ?? 0) : 0]}
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
          {(ditherStrength ?? 0) === 0
            ? "Off"
            : (ditherStrength ?? 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export default React.memo(Dithering);
