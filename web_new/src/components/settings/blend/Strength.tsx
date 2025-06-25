import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/store";

export default function Strength() {
  const setting = "smoothStrength";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);
  return (
    <div className="flex flex-col items-center justify-center">
      <label>Strength</label>
      <Slider
        defaultValue={[value ?? 0]}
        max={100}
        step={1}
        onValueChange={([v]) => setConfig(setting, v)}
      />
    </div>
  );
}
