import React from "react";

interface SettingItemWrapperProps {
  label: string;
  control?: React.ReactNode;
  children: React.ReactNode;
}

export default function SettingWrapper({
  label,
  control,
  children,
}: SettingItemWrapperProps) {
  return (
    <div className="flex flex-col gap-5 items-center">
      <div
        className={`flex flex-row items-center w-full ${
          control ? "justify-between" : "justify-center"
        }`}
      >
        <label className="text-lg">{label}</label>
        {control}
      </div>
      {children}
    </div>
  );
}
