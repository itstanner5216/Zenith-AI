import React, { useState } from 'react';
import { usePlugin } from '../../provider';
import { ModelType } from '../types';

interface SearchToggleProps {
  selectedModel: ModelType;
}

export function SearchToggle({ selectedModel }: SearchToggleProps) {
  const plugin = usePlugin();
  const [isEnabled, setIsEnabled] = useState(plugin.settings.enableSearchGrounding);
  const [isDeepSearch, setIsDeepSearch] = useState(plugin.settings.enableDeepSearch);

  const handleToggle = async () => {
    plugin.settings.enableSearchGrounding = !plugin.settings.enableSearchGrounding;
    await plugin.saveSettings();
    setIsEnabled(!isEnabled);
  };

  const handleDeepSearchToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    plugin.settings.enableDeepSearch = !plugin.settings.enableDeepSearch;
    await plugin.saveSettings();
    setIsDeepSearch(!isDeepSearch);
  };

  // Only show search controls for models that support search
  const supportsSearch = selectedModel === 'gpt-4o' || 
                         selectedModel === 'gpt-4o-mini' || 
                         selectedModel === 'gpt-4o-search-preview' || 
                         selectedModel === 'gpt-4o-mini-search-preview';
  
  if (!supportsSearch) {
    return null;
  }

  // For search-specific models, search is always enabled
  const isSearchModel = selectedModel === 'gpt-4o-search-preview' || 
                        selectedModel === 'gpt-4o-mini-search-preview';
  
  const searchAutoEnabled = isSearchModel;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={isSearchModel}
        className={`text-xs px-1.5 py-0.5 border rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(14,210,247,0.45)] active:scale-[0.97] transition-all duration-150 ${
          isEnabled || searchAutoEnabled
            ? "bg-[rgba(14,210,247,0.12)] text-[#0fb6d6] border-[rgba(14,210,247,0.45)] shadow-[0_0_6px_rgba(14,210,247,0.2)]" 
            : "bg-[#0d0b12] text-[#bebebe] border-[rgba(14,210,247,0.05)] hover:border-[rgba(14,210,247,0.15)] hover:text-[#0fb6d6]"
        }`}
        title={isEnabled ? "Disable internet search" : "Enable internet search"}
      >
        Search
      </button>
      
      {(isEnabled || searchAutoEnabled) && (
        <button
          onClick={handleDeepSearchToggle}
          className={`text-xs px-1.5 py-0.5 border rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(14,210,247,0.45)] active:scale-[0.97] transition-all duration-150 ${
            isDeepSearch 
              ? "bg-[rgba(14,210,247,0.12)] text-[#0fb6d6] border-[rgba(14,210,247,0.45)] shadow-[0_0_6px_rgba(14,210,247,0.2)]" 
              : "bg-[#0d0b12] text-[#bebebe] border-[rgba(14,210,247,0.05)] hover:border-[rgba(14,210,247,0.15)] hover:text-[#0fb6d6]"
          }`}
          title={isDeepSearch ? "Use standard search context" : "Use deep search with more context"}
        >
          Deep
        </button>
      )}
    </div>
  );
}
