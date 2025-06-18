import { Slider } from "@/components/ui/slider";

export default function Strength() {
  return (
    <div className="flex flex-col items-center justify-center">
      <label>Strength</label>
      <Slider defaultValue={[50]} max={100} step={1} />
    </div>
  );
}
