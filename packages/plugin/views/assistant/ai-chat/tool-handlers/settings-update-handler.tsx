import React from 'react';
import { usePlugin } from '../../provider';

interface SettingUpdateProps {
  setting: string;
  value: string;
  onValidate: () => void;
  isValidated: boolean;
}

const SettingUpdate = ({ setting, value, onValidate, isValidated }: SettingUpdateProps) => (
  <div className="flex items-center justify-between p-2.5 rounded-md border border-[rgba(14,210,247,0.1)] mb-2 bg-[#191621] hover:border-[rgba(14,210,247,0.18)] transition-colors duration-150">
    <div className="flex-1">
      <div className="font-medium text-[#bebebe] text-xs">{setting}</div>
      <div className="text-xs text-[#45aaff] break-all mt-0.5 opacity-70">{value}</div>
    </div>
    <button
      onClick={onValidate}
      disabled={isValidated}
      className={`ml-3 px-3 py-1 text-xs rounded-md font-medium transition-all duration-150 ${
        isValidated 
          ? 'bg-[rgba(14,210,247,0.15)] text-[#0fb6d6] border border-[rgba(14,210,247,0.3)] cursor-default' 
          : 'bg-[#0fb6d6] text-[#0d0b12] font-semibold border border-[#0fb6d6] hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] shadow-[0_0_6px_rgba(14,210,247,0.2)]'
      }`}
    >
      {isValidated ? '✓ Applied' : 'Apply'}
    </button>
  </div>
);

export function SettingsUpdateHandler({
  toolInvocation,
  handleAddResult,
}: {
  toolInvocation: any;
  handleAddResult: (result: string) => void;
}) {
  const plugin = usePlugin();
  const [validatedSettings, setValidatedSettings] = React.useState<Set<string>>(new Set());

  const settings = toolInvocation.args;

  const updateSetting = async (key: string, value: string) => {
    try {
      plugin.settings[key] = value;
      await plugin.saveSettings();
      setValidatedSettings(prev => new Set([...prev, key]));
      
      if (validatedSettings.size + 1 === Object.keys(settings).length) {
        handleAddResult(JSON.stringify({ success: true, message: 'All settings updated successfully' }));
      }
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-[#bebebe] mb-2">
        Review and apply the suggested settings:
      </div>
      {Object.entries(settings).map(([key, value]) => (
        <SettingUpdate
          key={key}
          setting={key}
          value={value as string}
          onValidate={() => updateSetting(key, value as string)}
          isValidated={validatedSettings.has(key)}
        />
      ))}
    </div>
  );
} 