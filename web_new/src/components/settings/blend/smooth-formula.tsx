import { useConfigStore } from "@/store";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { type SmoothFormula } from "palettum";

export default function SmoothFormula() {
  const setting = "smoothFormula";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <div className="flex flex-col items-center justify-center">
      <label>Mode</label>
      <ToggleSwitch
        options={[
          { label: "Idw", value: "Idw" },
          { label: "Gaus", value: "Gaussian" },
          { label: "Rq", value: "Rq" },
        ]}
        value={value}
        onChange={(v) => setConfig(setting, v as SmoothFormula)}
      />
    </div>
  );
}
