import { useConfigStore } from "@/stores";
import Quality from "./general/quality";
import { Dimensions } from "./general/dimensions";
import SmoothFormula from "./blend/smooth-formula";
import SmoothStrength from "./blend/smooth-strength";
import Dithering from "./match/dithering";
import Transparency from "./match/transparency";

export default function SettingsPanel() {
  const mapping = useConfigStore((state) => state.config.mapping);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-4 px-4">
        <Quality />
        <Dimensions />
      </div>
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
          <Dithering />
          <Transparency />
        </div>
      )}
    </div>
  );
}
