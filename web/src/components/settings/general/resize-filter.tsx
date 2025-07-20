import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import type { Filter } from "palettum";

export default function ResizeFilter() {
  const setting = "filter";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  const options = [
    { label: "Blocky", value: "Nearest" },
    { label: "Smooth", value: "Triangle" },
    { label: "Detail", value: "Lanczos3" },
  ];

  return (
    <ToggleSwitch
      options={options}
      value={value ?? "lanczos"}
      onChange={(v) => setConfig(setting, v as Filter)}
    />
  );
}
