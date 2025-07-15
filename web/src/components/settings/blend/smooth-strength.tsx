import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/stores";
import SettingItemWrapper from "../setting-item-wrapper";

export default function SmoothStrength() {
  const setting = "smoothStrength";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);
  return (
    <SettingItemWrapper label="Strength">
      <Slider
        value={[value ?? 0]}
        max={1}
        step={0.01}
        onValueChange={([v]) => setConfig(setting, v)}
        className="w-full"
      />
      <div className={`text-center text-sm ${value === 0 ? "text-muted-foreground" : ""}`}>
        {(value ?? 0).toFixed(2)}
      </div>
    </SettingItemWrapper>
  );
}
