import React from "react";

interface SettingItemWrapperProps {
  label: string;
  control?: React.ReactNode; 
  children: React.ReactNode;
}

export default function SettingItemWrapper({ label, control, children }: SettingItemWrapperProps) {
  return (
    <div className="flex flex-col gap-5 items-center p-4">
      <div className="flex flex-row items-center justify-center w-full gap-8">
        <label className="text-lg">{label}</label>
        {control}
      </div>
      {children}
    </div>
  );
}
