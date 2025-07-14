import { useConfigStore } from "@/store";
import QualitySetting from "./general/quality-setting";
import SmoothFormula from "./blend/smooth-formula";
import SmoothStrength from "./blend/smooth-strength";
import MatchSettings from "./match/match-settings";

export default function SettingsPanel() {
  const mapping = useConfigStore((state) => state.config.mapping);

  return (
    <div className="flex flex-col gap-4">
      <QualitySetting />
      {mapping === "Smoothed" ? (
        <>
          <SmoothFormula />
          <SmoothStrength />
        </>
      ) : (
        <MatchSettings />
      )}
    </div>
  );
}
