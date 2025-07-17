import { useConfigStore } from "@/stores";
import Quality from "./general/quality";
import { Dimensions } from "./general/dimensions";
import ResizeFilter from "./general/resize-filter";
import SmoothFormula from "./blend/smooth-formula";
import SmoothStrength from "./blend/smooth-strength";
import Dithering from "./match/dithering";
import Transparency from "./match/transparency";
import { Separator } from "@/components/ui/separator";
import { ResponsiveContainer } from "@/components/ui/responsive-container";
import { SettingsGroup } from "./settings-group";

export default function SettingsPanel() {
  const mapping = useConfigStore((state) => state.config.mapping);

  return (
    <div className="flex flex-col gap-6 p-6">
      <ResponsiveContainer breakpoint={500}>
        <Quality />
        <SettingsGroup constrainHeader>
          <Dimensions />
          <ResizeFilter />
        </SettingsGroup>
      </ResponsiveContainer>

      <Separator className="my-2" />

      <ResponsiveContainer breakpoint={400}>
        {mapping === "Smoothed" ? (
          <>
            <SmoothFormula />
            <SmoothStrength />
          </>
        ) : (
          <>
            <Dithering />
            <Transparency />
          </>
        )}
      </ResponsiveContainer>
    </div>
  );
}
