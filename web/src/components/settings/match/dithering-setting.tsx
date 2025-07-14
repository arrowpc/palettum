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
    if (checked) {
      setConfig("ditherAlgorithm", "Bn");
      if (ditherStrength === 0) {
        setConfig("ditherStrength", 0.5);
      }
    } else {
      setConfig("ditherAlgorithm", "None");
      setConfig("ditherStrength", 0);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4">
      <div className="flex items-center justify-center mb-2">
        <label htmlFor="dithering-switch" className="text-base mr-2">Dithering</label>
        <Switch
          id="dithering-switch"
          checked={isDitheringEnabled}
          onCheckedChange={handleCheckedChange}
        />
      </div>
      <Slider
            value={[isDitheringEnabled ? ditherStrength : 0]}
            max={1}
            step={0.01}
            onValueChange={([v]) => {
              setConfig("ditherStrength", v);
              if (v === 0) {
                setConfig("ditherAlgorithm", "None");
              } else if (ditherAlgorithm === "None" && v > 0) {
                setConfig("ditherAlgorithm", "Bn");
              }
            }}
            className="w-full"
          />
      <div className="text-center text-sm text-muted-foreground">
        {ditherStrength === 0 ? "Off" : ditherStrength.toFixed(2)}
      </div>
    </div>
  );
}