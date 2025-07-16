import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import { type DiffFormula } from "palettum";
import SettingWrapper from "../setting-wrapper";

export default function Quality() {
  const setting = "diffFormula";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <SettingWrapper label="Quality">
      <ToggleSwitch
        options={[
          { label: "High", value: "CIEDE2000" },
          { label: "Med", value: "CIE94" },
          { label: "Low", value: "CIE76" },
        ]}
        value={value ?? "CIEDE2000"}
        onChange={(v) => setConfig(setting, v as DiffFormula)}
      />
    </SettingWrapper>
  );
}
