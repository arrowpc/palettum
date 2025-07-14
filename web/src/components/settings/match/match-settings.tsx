import DitheringSetting from "./dithering-setting";
import TransparencySetting from "./transparency-setting";

export default function MatchSettings() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <DitheringSetting />
      <TransparencySetting />
    </div>
  );
}
