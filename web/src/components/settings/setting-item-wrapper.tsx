import React from "react";

interface SettingItemWrapperProps {
  label: string;
  control?: React.ReactNode; // New prop for control (e.g., Switch)
  children: React.ReactNode;
}

export default function SettingItemWrapper({ label, control, children }: SettingItemWrapperProps) {
  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex flex-row items-center justify-between w-full">
        <label className="text-lg">{label}</label>
        {control}
      </div>
      {children}
    </div>
  );
}
