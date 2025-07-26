import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import type { SmoothFormula } from "palettum";

export default function SmoothFormula() {
  const setting = "smoothFormula";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="text-lg font-medium">Mode</label>
      <ToggleSwitch
        options={[
          { label: "Idw", value: "Idw" },
          { label: "Gaus", value: "Gaussian" },
          { label: "Rq", value: "Rq" },
        ]}
        value={value ?? "Idw"}
        onChange={(v) => setConfig(setting, v as SmoothFormula)}
      />
    </div>
  );
}
