import { useConfigStore } from "@/stores";
import Quality from "./general/quality";
import { Dimensions } from "./general/dimensions";
import ResizeFilter from "./general/resize-filter";
import SmoothFormula from "./blend/smooth-formula";
import SmoothStrength from "./blend/smooth-strength";
import Dithering from "./match/dithering";
import Transparency from "./match/transparency";
import { Separator } from "@/components/ui/separator";

export default function SettingsPanel() {
  const mapping = useConfigStore((state) => state.config.mapping);

  return (
    <div className="@container flex flex-col gap-6 p-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Quality />
          </div>
          <div className="space-y-4">
            <Dimensions />
            <ResizeFilter />
          </div>
        </div>
      </div>

      <Separator className="my-2" />
      <div className="space-y-4">
        {mapping === "Smoothed" ? (
          <div className="grid grid-cols-1 @xl:grid-cols-2 gap-6">
            <SmoothFormula />
            <SmoothStrength />
          </div>
        ) : (
          <div className="grid grid-cols-1 @xl:grid-cols-2 gap-6">
            <Dithering />
            <Transparency />
          </div>
        )}
      </div>
    </div>
  );
}
