import { useState } from "react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { type DiffFormula } from "palettum";

export default function Quality() {
  const [mode, setMode] = useState<DiffFormula>("CIEDE2000");
  return (
    <div className="flex flex-col items-center justify-center">
      <label>Quality</label>
      <ToggleSwitch
        options={[
          { label: "High", value: "CIEDE2000" },
          { label: "Med", value: "CIE94" },
          { label: "Low", value: "CIE76" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as DiffFormula)}
      />
    </div>
  );
}
