import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import { type DiffFormula } from "palettum";
import SettingItemWrapper from "../setting-item-wrapper";

export default function QualitySetting() {
  const setting = "diffFormula";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <SettingItemWrapper label="Quality">
      <ToggleSwitch
        options={[
          { label: "High", value: "CIEDE2000" },
          { label: "Med", value: "CIE94" },
          { label: "Low", value: "CIE76" },
        ]}
        value={value ?? "CIEDE2000"}
        onChange={(v) => setConfig(setting, v as DiffFormula)}
      />
    </SettingItemWrapper>
  );
}
