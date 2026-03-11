import React, { useState } from 'react';
import ZenithAI from '../../index';
import { GeneralTab } from './general-tab';
import { FileConfigTab } from './file-config-tab';
import { CustomizationTab } from './customization-tab';
import { AdvancedTab } from './advanced-tab';
import { ExperimentTab } from './experiment-tab';

interface Tab {
  name: string;
  component: React.ComponentType<{ plugin: ZenithAI }>;
}

interface SettingsTabContentProps {
  plugin: ZenithAI;
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({ plugin }) => {
  const [activeTab, setActiveTab] = useState('General');

  const tabs: Tab[] = [
    { name: 'General', component: GeneralTab },
    { name: 'Organization Preferences', component: CustomizationTab },
    { name: 'Vault Access', component: FileConfigTab },
    { name: 'Experiment', component: ExperimentTab },
    { name: 'Advanced', component: AdvancedTab },
  ];

  return (
    <div className="flex flex-col h-full bg-[#100e17]">
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabClick={setActiveTab} />
      <TabContent tabs={tabs} activeTab={activeTab} plugin={plugin} />
    </div>
  );
};

const TabNavigation: React.FC<{
  tabs: Tab[];
  activeTab: string;
  onTabClick: (tabName: string) => void;
}> = ({ tabs, activeTab, onTabClick }) => (
  <div className="flex w-full border-b border-[rgba(14,210,247,0.12)] bg-[#0d0b12]">
    {tabs.map((tab) => (
      <TabButton
        key={tab.name}
        name={tab.name}
        isActive={activeTab === tab.name}
        onClick={() => onTabClick(tab.name)}
      />
    ))}
  </div>
);

const TabButton: React.FC<{
  name: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ name, isActive, onClick }) => (
  <div
    className={`w-min flex-1 py-2.5 px-4 text-sm font-medium text-center cursor-pointer select-none transition-all duration-200
      ${isActive
        ? 'text-[#0fb6d6] border-b-2 border-[#0fb6d6] bg-[rgba(14,210,247,0.05)] -mb-px'
        : 'text-[#7aa2f7] border-b-2 border-transparent hover:text-[#bebebe] hover:bg-[rgba(14,210,247,0.03)]'
      }`}
    onClick={onClick}
    role="tab"
    aria-selected={isActive}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
  >
    {name}
  </div>
);

const TabContent: React.FC<{
  tabs: Tab[];
  activeTab: string;
  plugin: ZenithAI;
}> = ({ tabs, activeTab, plugin }) => (
  <div className="flex-1 overflow-y-auto p-4 border border-[rgba(14,210,247,0.08)] border-t-0 bg-[#100e17] rounded-b-md">
    {tabs.map((tab) => (
      <div key={tab.name} className={activeTab === tab.name ? 'block' : 'hidden'}>
        <tab.component plugin={plugin} />
      </div>
    ))}
  </div>
);
