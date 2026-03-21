import React from 'react';
import { ModelType } from './types';
import { usePlugin } from '../provider';

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelSelect: (model: ModelType) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelSelect,
}) => {
  const plugin = usePlugin();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(selectedModel);

  const handleSave = async () => {
    const value = draft.trim();
    plugin.settings.selectedModel = value;
    await plugin.saveSettings();
    onModelSelect(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="model name"
          className="w-28 px-2 py-0.5 text-xs bg-[#0d0b12] text-[#bebebe] border border-[rgba(14,210,247,0.45)] rounded focus:outline-none focus:shadow-[0_0_6px_rgba(14,210,247,0.2)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
        />
        <button
          onClick={handleSave}
          className="text-xs px-2 py-0.5 bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border border-[rgba(14,210,247,0.15)] rounded hover:bg-[rgba(14,210,247,0.18)] active:scale-[0.97] transition-all duration-150"
        >
          Save
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="text-xs px-1 py-0.5 text-[#45aaff] hover:text-[#bebebe] transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => { setDraft(selectedModel); setIsEditing(true); }}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all duration-150 text-[#45aaff] hover:text-[#0fb6d6] hover:bg-[rgba(14,210,247,0.06)] cursor-pointer border border-transparent hover:border-[rgba(14,210,247,0.15)]"
      title="Click to change model"
    >
      <span className="font-medium">{selectedModel || "set model"}</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 opacity-60">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    </div>
  );
};
