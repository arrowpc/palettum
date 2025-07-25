import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import type { DiffFormula } from "palettum";

export default function Quality() {
  const setting = "diffFormula";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="text-lg font-medium">Quality</label>
      <ToggleSwitch
        options={[
          { label: "High", value: "CIEDE2000" },
          { label: "Med", value: "CIE94" },
          { label: "Low", value: "CIE76" },
        ]}
        value={value ?? "CIEDE2000"}
        onChange={(v) => setConfig(setting, v as DiffFormula)}
      />
    </div>
  );
}
