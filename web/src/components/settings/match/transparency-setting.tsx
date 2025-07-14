import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConfigStore, useMediaStore } from "@/store";

export default function TransparencySetting() {
  const { transparencyThreshold } = useConfigStore((state) => state.config);
  const hasAlpha = useMediaStore((state) => state.hasAlpha);
  const setConfig = useConfigStore((state) => state.setConfig);

  const isTransparencyEnabled = transparencyThreshold < 255;

  const handleCheckedChange = (checked: boolean) => {
    setConfig("transparencyThreshold", checked ? 128 : 255);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="transparency-switch">Transparency</label>
        <Switch
          id="transparency-switch"
          checked={isTransparencyEnabled}
          onCheckedChange={handleCheckedChange}
          disabled={!hasAlpha}
        />
      </div>
      {isTransparencyEnabled && hasAlpha && (
        <>
          <Slider
            defaultValue={[transparencyThreshold]}
            max={255}
            step={1}
            onValueChange={([v]) => setConfig("transparencyThreshold", v)}
          />
          <div className="text-center text-sm text-muted-foreground">
            {transparencyThreshold}
          </div>
        </>
      )}
      {!hasAlpha && (
        <div className="text-center text-sm text-muted-foreground">
          No Alpha detected in media
        </div>
      )}
    </div>
  );
}
