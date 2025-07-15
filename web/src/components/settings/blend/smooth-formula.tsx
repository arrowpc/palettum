import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import { type SmoothFormula } from "palettum";
import SettingItemWrapper from "../setting-item-wrapper";

export default function SmoothFormula() {
  const setting = "smoothFormula";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <SettingItemWrapper label="Mode">
      <ToggleSwitch
        options={[
          { label: "Idw", value: "Idw" },
          { label: "Gaus", value: "Gaussian" },
          { label: "Rq", value: "Rq" },
        ]}
        value={value}
        onChange={(v) => setConfig(setting, v as SmoothFormula)}
      />
    </SettingItemWrapper>
  );
}
