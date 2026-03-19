import React, { useState } from 'react';
import ZenithAI from '../../index';
import { GeneralTab } from './general-tab';
import { AdvancedTab } from './advanced-tab';

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
    { name: 'Advanced', component: AdvancedTab },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d0b12]">
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
  <div className="flex w-full border-b border-[rgba(14,210,247,0.1)] bg-[#0d0b12] overflow-x-auto">
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
    className={`flex-shrink-0 py-2.5 px-3 text-xs font-medium text-center cursor-pointer select-none transition-all duration-150
      ${isActive
        ? 'text-[#0fb6d6] border-b-2 border-[#0fb6d6] bg-[rgba(14,210,247,0.06)] -mb-px shadow-[inset_0_-1px_0_rgba(14,210,247,0.4)]'
        : 'text-[#45aaff] border-b-2 border-transparent hover:text-[#0fb6d6] hover:bg-[rgba(14,210,247,0.04)] hover:border-[rgba(14,210,247,0.2)]'
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
  <div className="flex-1 overflow-y-auto p-4 bg-[#100e17]">
    {tabs.map((tab) => (
      <div key={tab.name} className={activeTab === tab.name ? 'block' : 'hidden'}>
        <tab.component plugin={plugin} />
      </div>
    ))}
  </div>
);
