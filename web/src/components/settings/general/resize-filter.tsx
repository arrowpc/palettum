import { useConfigStore } from "@/stores";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import SettingWrapper from "../setting-wrapper";
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
    <SettingWrapper label="">
      <ToggleSwitch
        options={options}
        value={value ?? "lanczos"}
        onChange={(v) => setConfig(setting, v as Filter)}
      />
    </SettingWrapper>
  );
}
