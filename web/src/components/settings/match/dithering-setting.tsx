import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConfigStore } from "@/store";

export default function DitheringSetting() {
  const { ditherAlgorithm, ditherStrength } = useConfigStore(
    (state) => state.config,
  );
  const setConfig = useConfigStore((state) => state.setConfig);

  const isDitheringEnabled = ditherAlgorithm !== "None";

  const handleCheckedChange = (checked: boolean) => {
    setConfig("ditherAlgorithm", checked ? "Bn" : "None");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="dithering-switch">Dithering</label>
        <Switch
          id="dithering-switch"
          checked={isDitheringEnabled}
          onCheckedChange={handleCheckedChange}
        />
      </div>
      {isDitheringEnabled && (
        <>
          <Slider
            defaultValue={[ditherStrength]}
            max={1}
            step={0.01}
            onValueChange={([v]) => setConfig("ditherStrength", v)}
          />
          <div className="text-center text-sm text-muted-foreground">
            {ditherStrength.toFixed(2)}
          </div>
        </>
      )}
    </div>
  );
}