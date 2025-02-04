import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface TransparencyThresholdProps {
  onChange: (value: number) => void;
}

const TransparencyThreshold: React.FC<TransparencyThresholdProps> = ({
  onChange,
}) => {
  const [value, setValue] = useState(0);

  const handleSliderChange = (newValue: number[]) => {
    const threshold = newValue[0];
    setValue(threshold);
    onChange(threshold);
  };

  return (
    <div className="space-y-2">
      <label>Transparency Threshold: {value}</label>
      <Slider
        value={[value]}
        onValueChange={handleSliderChange}
        min={0}
        max={255}
        step={1}
      />
    </div>
  );
};

export default TransparencyThreshold;
