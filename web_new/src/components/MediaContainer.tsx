import { useState } from "react";
import { ToggleSwitch } from "./ui/toggle-switch";
import { cn } from "./../lib/utils";

const RADIUS_VALUE = 5;
const RADIUS_UNIT = "vw";
const BORDER_RADIUS = `${RADIUS_VALUE}${RADIUS_UNIT}`;
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

type Mode = "on" | "off";

export default function MediaContainer() {
  const [mode, setMode] = useState<Mode>("off");

  return (
    <div
      className={cn(
        "relative w-full aspect-[16/9] bg-gray-200 overflow-visible",
        `rounded-[${BORDER_RADIUS}]`,
      )}
    >
      <div
        className="absolute text-xl font-bold"
        style={{
          top: CORNER_OFFSET,
          right: CORNER_OFFSET,
          transform: "translate(50%, -50%)",
        }}
      >
        x
      </div>

      <ToggleSwitch
        className="absolute bottom-0 left-0"
        options={[
          { label: "On", value: "on" },
          { label: "Off", value: "off" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      />
    </div>
  );
}
