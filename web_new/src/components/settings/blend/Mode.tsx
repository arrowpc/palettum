import { useState } from "react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { type SmoothFormula } from "palettum";

export default function Mode() {
  const [mode, setMode] = useState<SmoothFormula>("Idw");
  return (
    <div className="flex flex-col items-center justify-center">
      <label>Mode</label>
      <ToggleSwitch
        options={[
          { label: "Idw", value: "Idw" },
          { label: "Gaus", value: "Gaussian" },
          { label: "Rq", value: "Rq" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as SmoothFormula)}
      />
    </div>
  );
}
