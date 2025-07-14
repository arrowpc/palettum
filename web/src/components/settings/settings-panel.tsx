import { useConfigStore } from "@/store";
import QualitySetting from "./general/quality-setting";
import SmoothFormula from "./blend/smooth-formula";
import SmoothStrength from "./blend/smooth-strength";
import DitheringSetting from "./match/dithering-setting";
import TransparencySetting from "./match/transparency-setting";

export default function SettingsPanel() {
  const mapping = useConfigStore((state) => state.config.mapping);

  return (
    <div className="flex flex-col gap-4">
      <QualitySetting />
      {mapping === "Smoothed" ? (
        <div className="flex flex-row gap-4 px-4">
          <div className="w-1/2">
            <SmoothFormula />
          </div>
          <div className="w-1/2">
            <SmoothStrength />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-4">
          <DitheringSetting />
          <TransparencySetting />
        </div>
      )}
    </div>
  );
}
