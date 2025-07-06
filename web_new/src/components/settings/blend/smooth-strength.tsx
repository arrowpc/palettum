import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/store";

export default function SmoothStrength() {
  const setting = "smoothStrength";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);
  return (
    <div className="flex flex-col items-center justify-center">
      <label>Strength</label>
      <Slider
        defaultValue={[value]}
        max={1}
        step={0.01}
        onValueChange={([v]) => setConfig(setting, v)}
      />
    </div>
  );
}
