import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConfigStore, useMediaStore } from "@/store";

export default function TransparencySetting() {
  const { transparencyThreshold } = useConfigStore((state) => state.config);
  const hasAlpha = useMediaStore((state) => state.hasAlpha);
  const setConfig = useConfigStore((state) => state.setConfig);

  const isTransparencyEnabled = transparencyThreshold > 0;

  const handleCheckedChange = (checked: boolean) => {
    if (checked) {
      if (transparencyThreshold === 0) {
        setConfig("transparencyThreshold", 128);
      }
    } else {
      setConfig("transparencyThreshold", 0);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4">
      <div className="flex items-center justify-center mb-2">
        <label htmlFor="transparency-switch" className="text-base mr-2">Transparency</label>
        <Switch
          id="transparency-switch"
          checked={isTransparencyEnabled && hasAlpha}
          onCheckedChange={handleCheckedChange}
          disabled={!hasAlpha}
        />
      </div>
      <Slider
        value={[transparencyThreshold]}
        max={255}
        step={1}
        onValueChange={([v]) => {
          setConfig("transparencyThreshold", v);
        }}
        className="w-full"
        disabled={!hasAlpha}
      />
      <div className="text-center text-sm text-muted-foreground">
        {transparencyThreshold === 0 ? "Off" : transparencyThreshold}
      </div>
      {!hasAlpha && (
        <div className="text-center text-sm text-muted-foreground">
          No Alpha detected in media
        </div>
      )}
    </div>
  );
}
