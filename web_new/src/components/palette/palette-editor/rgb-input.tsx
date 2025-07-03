import React from "react";

interface RGBInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export const RGBInput: React.FC<RGBInputProps> = ({
  label,
  value,
  onChange,
  onBlur,
}) => (
  <div className="flex items-center gap-1">
    <label
      htmlFor={`rgb-${label}`}
      className="text-sm font-medium text-foreground"
    >
      {label}
    </label>
    <input
      id={`rgb-${label}`}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={3}
      value={value}
      onChange={(e) => {
        if (/^\d{0,3}$/.test(e.target.value)) {
          onChange(e.target.value);
        }
      }}
      onBlur={onBlur}
      className="w-14 px-1 py-1 border rounded-lg text-sm text-center bg-background border-border focus:ring-2 focus:ring-ring focus:border-border-active"
    />
  </div>
);
