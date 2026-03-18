import React, { useId } from "react";
import type ZenithAI from "../../index";
import type { ZenithAISettings } from "../../settings";

export type BooleanSettingKeys = {
  [K in keyof ZenithAISettings]: ZenithAISettings[K] extends boolean
    ? K
    : never;
}[keyof ZenithAISettings];

export async function handleSettingChange<T>(
  plugin: ZenithAI,
  value: T,
  setter: React.Dispatch<React.SetStateAction<T>>,
  settingKey: keyof ZenithAISettings,
): Promise<void> {
  setter(value);
  (plugin.settings as any)[settingKey] = value; // nosemgrep: detect-object-injection
  await plugin.saveSettings();
}

export interface ToggleSettingProps {
  name: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  name,
  description,
  value,
  onChange,
}) => {
  const id = useId();
  const descId = `${id}-desc`;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 group hover:bg-[var(--background-modifier-hover)] rounded-md px-1 -mx-1 transition-colors duration-150">
      <div className="flex-1 mr-4">
        <label
          htmlFor={id}
          className="font-medium text-[var(--text-normal)] text-sm leading-snug cursor-pointer"
        >
          {name}
        </label>
        <div
          id={descId}
          className="text-xs text-[var(--text-dim)] mt-0.5 leading-relaxed opacity-60"
        >
          {description}
        </div>
      </div>
      <div className="flex-shrink-0">
        <label
          className="relative inline-flex items-center cursor-pointer"
          title={value ? "Enabled" : "Disabled"}
        >
          <input
            id={id}
            type="checkbox"
            checked={value}
            onChange={e => onChange(e.target.checked)}
            aria-describedby={descId}
            className="sr-only peer"
          />
          <div
            className={`relative w-9 h-5 rounded-full border transition-all duration-200 ${value ? "bg-[var(--interactive-accent)] border-[var(--interactive-accent)] shadow-[0_0_6px_var(--interactive-accent)]" : "bg-[var(--background-modifier-form-field)] border-[var(--background-modifier-border)] group-hover:border-[var(--interactive-accent)]"}`}
          >
            <div
              className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200 shadow-sm ${value ? "translate-x-[18px] bg-[var(--background-primary)] shadow-[0_0_6px_var(--interactive-accent)]" : "translate-x-0.5 bg-[var(--text-muted)] opacity-70"}`}
            />
          </div>
        </label>
      </div>
    </div>
  );
};

export interface TextInputSettingProps {
  name: string;
  description: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export const TextInputSetting: React.FC<TextInputSettingProps> = ({
  name,
  description,
  value,
  placeholder,
  onChange,
  onBlur,
}) => {
  const id = useId();
  const descId = `${id}-desc`;

  return (
    <div className="py-2">
      <label
        htmlFor={id}
        className="font-medium"
        style={{ color: "var(--text-normal)" }}
      >
        {name}
      </label>
      <div
        id={descId}
        className="text-xs mb-1 opacity-75"
        style={{ color: "var(--text-dim)" }}
      >
        {description}
      </div>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        aria-describedby={descId}
        className="w-full px-3 py-2 text-xs rounded-md bg-[var(--bg-depth-1)] text-[var(--text-normal)] border border-[var(--border-defined)] focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] transition-all duration-150 placeholder:text-[var(--text-dim)] placeholder:opacity-60"
      />
    </div>
  );
};

export interface TextAreaSettingProps {
  name: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const TextAreaSetting: React.FC<TextAreaSettingProps> = ({
  name,
  description,
  value,
  onChange,
  disabled,
}) => {
  const id = useId();
  const descId = `${id}-desc`;

  return (
    <div className="py-2">
      <label htmlFor={id} className="font-medium text-[var(--text-normal)]">
        {name}
      </label>
      <div
        id={descId}
        className="text-xs text-[var(--text-dim)] mb-1 opacity-60"
      >
        {description}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={descId}
        className="w-full px-3 py-2 text-[var(--text-normal)] bg-[var(--bg-depth-1)] border border-[var(--border-defined)] rounded-md focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] disabled:bg-[var(--bg-depth-3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 resize-none text-xs leading-relaxed placeholder:text-[var(--text-dim)] placeholder:opacity-60"
        rows={4}
      />
    </div>
  );
};

export interface DropdownSettingProps {
  name: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export const DropdownSetting: React.FC<DropdownSettingProps> = ({
  name,
  description,
  value,
  options,
  onChange,
}) => {
  const id = useId();
  const descId = `${id}-desc`;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 group hover:bg-[var(--background-modifier-hover)] rounded-md px-1 -mx-1 transition-colors duration-150">
      <div className="flex-1 mr-4">
        <label
          htmlFor={id}
          className="font-medium text-[var(--text-normal)] text-sm leading-snug cursor-pointer"
        >
          {name}
        </label>
        <div
          id={descId}
          className="text-xs text-[var(--text-dim)] mt-0.5 leading-relaxed opacity-60"
        >
          {description}
        </div>
      </div>
      <div className="flex-shrink-0">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-describedby={descId}
          className="px-3 py-1.5 text-xs rounded-md bg-[var(--bg-depth-1)] text-[var(--text-normal)] border border-[var(--border-defined)] focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] transition-all duration-150 appearance-none cursor-pointer"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
