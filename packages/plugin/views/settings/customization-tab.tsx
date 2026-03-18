import React, { useState } from 'react';
import type ZenithAI from '../../index';
import { DEFAULT_SETTINGS } from '../../settings';
import {
  ToggleSetting,
  TextInputSetting,
  TextAreaSetting,
  DropdownSetting,
  handleSettingChange,
} from './components';

interface CustomizationTabProps {
  plugin: InstanceType<typeof ZenithAI>;
}

export const CustomizationTab: React.FC<CustomizationTabProps> = ({ plugin }) => {
  const [enableFileRenaming, setEnableFileRenaming] = useState(plugin.settings.enableFileRenaming);
  const [renameInstructions, setRenameInstructions] = useState(plugin.settings.renameInstructions);
  const [useSimilarTags, setUseSimilarTags] = useState(plugin.settings.useSimilarTags);
  const [useSimilarTagsInFrontmatter, setUseSimilarTagsInFrontmatter] = useState(plugin.settings.useSimilarTagsInFrontmatter);
  const [useVaultTitles, setUseVaultTitles] = useState(plugin.settings.useVaultTitles);
  const [customFolderInstructions, setCustomFolderInstructions] = useState(plugin.settings.customFolderInstructions);
  const [enableDocumentClassification, setEnableDocumentClassification] = useState(plugin.settings.enableDocumentClassification);
  const [customTagInstructions, setCustomTagInstructions] = useState(plugin.settings.customTagInstructions);
  const [vertexBrainUrl, setVertexBrainUrl] = useState(plugin.settings.vertexBrainUrl ?? "");
  const [enableVectorAutoSort, setEnableVectorAutoSort] = useState(plugin.settings.enableVectorAutoSort ?? false);
  const [autoSortConfidenceThreshold, setAutoSortConfidenceThreshold] = useState(plugin.settings.autoSortConfidenceThreshold ?? 0.75);
  const [organizationRulesPath, setOrganizationRulesPath] = useState(plugin.settings.organizationRulesPath ?? "");
  const [formatBehavior, setFormatBehavior] = useState<"override" | "newFile" | "append">(
    plugin.settings.formatBehavior || DEFAULT_SETTINGS.formatBehavior
  );

  return (
    <div className="p-4 space-y-8">
      {/* Inbox Processing Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-[var(--text-accent)]">Inbox Processing</h3>
        <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg mb-4 border border-[var(--border-defined)] shadow-elevation-md">
          <div className="text-xs text-[var(--text-dim)] opacity-70">
            These settings control how new files are automatically handled when they enter your vault through the inbox.
            Enable or disable automatic processing features and configure how the AI should handle your incoming documents.
          </div>
        </div>
        <div className="space-y-4">
          <ToggleSetting
            name="Inbox Auto-Renaming"
            description="Automatically rename new files when they are processed through the inbox."
            value={enableFileRenaming}
            onChange={async (value) => handleSettingChange(plugin, value, setEnableFileRenaming, 'enableFileRenaming')}
          />
          <ToggleSetting
            name="Inbox Auto-Formatting"
            description="Automatically format new documents when they match a template category during inbox processing."
            value={enableDocumentClassification}
            onChange={async (value) => handleSettingChange(plugin, value, setEnableDocumentClassification, 'enableDocumentClassification')}
          />
          <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg mt-2 border border-[var(--border-defined)] shadow-elevation-md">
            <div className="font-medium text-[var(--text-normal)] mb-2">Document Type Templates</div>
            <div className="text-xs text-[var(--text-dim)] opacity-70">
              To enable auto-formatting, create template files in the Zenith-AI template folder.
              Name each file according to its document type (e.g., 'workout.md', 'meeting-notes.md').
              The content of each file should contain the formatting instructions.
              You can manage these templates through the AI sidebar.
            </div>
          </div>
          <ToggleSetting
            name="Inbox Similar Tags"
            description="Automatically append similar tags to new files during inbox processing."
            value={useSimilarTags}
            onChange={async (value) => handleSettingChange(plugin, value, setUseSimilarTags, 'useSimilarTags')}
          />
        </div>
      </section>

      {/* General Settings Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-[var(--text-accent)]">General Settings</h3>
        <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg mb-4 border border-[var(--border-defined)] shadow-elevation-md">
          <div className="text-xs text-[var(--text-dim)] opacity-70">
            Configure how Zenith-AI behaves across your vault. These settings affect both manual operations
            and provide the base configuration for inbox processing. Customize naming conventions, tagging behavior,
            and folder organization to match your workflow.
          </div>
        </div>

        {/* File Naming subsection */}
        <div className="mb-6">
          <h4 className="font-medium text-[var(--text-normal)] mb-2">File Naming</h4>
          <div className="space-y-4">
            <TextAreaSetting
              name="Rename Instructions"
              description="Instructions for how files should be renamed based on their content."
              value={renameInstructions}
              onChange={async (value) => handleSettingChange(plugin, value, setRenameInstructions, 'renameInstructions')}
            />
            <ToggleSetting
              name="Use Vault Context"
              description="Improve AI-generated titles by providing examples from your vault (uses 20 random titles)."
              value={useVaultTitles}
              onChange={async (value) => handleSettingChange(plugin, value, setUseVaultTitles, 'useVaultTitles')}
            />
          </div>
        </div>

        {/* Tags subsection */}
        <div className="mb-6">
          <h4 className="font-medium text-[var(--text-normal)] mb-2">Tags</h4>
          <div className="space-y-4">
            <ToggleSetting
              name="Use Frontmatter"
              description="Add similar tags in frontmatter instead of inline."
              value={useSimilarTagsInFrontmatter}
              onChange={async (value) => handleSettingChange(plugin, value, setUseSimilarTagsInFrontmatter, 'useSimilarTagsInFrontmatter')}
            />
            <TextAreaSetting
              name="Tag Generation Instructions"
              description="Custom instructions for generating tags for your notes."
              value={customTagInstructions}
              onChange={async (value) => handleSettingChange(plugin, value, setCustomTagInstructions, 'customTagInstructions')}
            />
          </div>
        </div>

        {/* Folder Section */}
        <div className="mb-6">
          <h4 className="font-medium text-[var(--text-normal)] mb-2">Folder Organization</h4>
          <div className="space-y-4">
            <TextAreaSetting
              name="Custom Folder Determination Instructions"
              description="Provide custom instructions for determining which folders to place your notes in."
              value={customFolderInstructions}
              onChange={async (value) => handleSettingChange(plugin, value, setCustomFolderInstructions, 'customFolderInstructions')}
            />
          </div>
        </div>

        {/* Formatting Section */}
        <div className="mb-6">
          <h4 className="font-medium text-[var(--text-normal)] mb-2">Formatting</h4>
          <div className="space-y-4">
            <DropdownSetting
              name="Format Behavior"
              description="Controls how AI formatting is applied to notes. Replace overwrites the current content, New File creates a separate formatted copy, and Append adds formatted content to the end."
              value={formatBehavior}
              options={[
                { value: "override", label: "Replace" },
                { value: "newFile", label: "New File" },
                { value: "append", label: "Append" },
              ]}
              onChange={async (value) => {
                await handleSettingChange(
                  plugin,
                  value as "override" | "newFile" | "append",
                  setFormatBehavior,
                  "formatBehavior"
                );
              }}
            />
          </div>
        </div>

      </section>

      {/* Vault Intelligence Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-accent)" }}>Vault Intelligence</h3>
        <div className="rounded-lg mb-4 p-4" style={{ background: "var(--bg-depth-3)", border: "1px solid var(--border-defined)" }}>
          <div className="text-xs opacity-70" style={{ color: "var(--text-dim)" }}>
            Semantic auto-sorting powered by your Vertex AI Brain
          </div>
        </div>
        <div className="space-y-4">
          <TextInputSetting
            name="Vertex Brain URL"
            description="URL of your Vertex AI Brain gateway (leave empty to disable)"
            value={vertexBrainUrl}
            placeholder="http://localhost:8085"
            onChange={async (value) => {
              setVertexBrainUrl(value);
              (plugin.settings.vertexBrainUrl as string) = value;
              await plugin.saveSettings();
            }}
          />
          <ToggleSetting
            name="Enable Vector Auto-Sort"
            description="Automatically route General files using semantic embeddings"
            value={enableVectorAutoSort}
            onChange={async (value) => handleSettingChange(plugin, value, setEnableVectorAutoSort, 'enableVectorAutoSort')}
          />
          <NumberInputSetting
            name="Auto-Sort Confidence Threshold"
            description="Minimum confidence (0–1) to auto-sort without showing suggestion UI. Default: 0.75"
            value={autoSortConfidenceThreshold}
            min={0}
            max={1}
            step={0.05}
            onChange={async (value) => {
              setAutoSortConfidenceThreshold(value);
              (plugin.settings.autoSortConfidenceThreshold as number) = value;
              await plugin.saveSettings();
            }}
          />
          <TextInputSetting
            name="Cosmic Vault Structure Path"
            description="Path to the note that defines your Cosmic Vault Structure"
            value={organizationRulesPath}
            placeholder="System/Cosmic Vault Structure.md"
            onChange={async (value) => {
              setOrganizationRulesPath(value);
              (plugin.settings.organizationRulesPath as string) = value;
              await plugin.saveSettings();
            }}
          />
        </div>
      </section>
    </div>
  );
};

// NumberInputSetting is only used in this tab — not extracted to components.tsx
interface NumberInputSettingProps {
  name: string;
  description: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

const NumberInputSetting: React.FC<NumberInputSettingProps> = ({ name, description, value, min, max, step, onChange }) => (
  <div className="py-2">
    <div className="font-medium" style={{ color: "var(--text-normal)" }}>{name}</div>
    <div className="text-xs mb-1 opacity-75" style={{ color: "var(--text-dim)" }}>{description}</div>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-24 px-3 py-2 text-xs rounded-md bg-[var(--bg-depth-1)] text-[var(--text-normal)] border border-[var(--border-defined)] focus:outline-none focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-accent)] focus:shadow-[0_0_8px_rgba(14,210,247,0.1)] transition-all duration-150"
    />
  </div>
);
