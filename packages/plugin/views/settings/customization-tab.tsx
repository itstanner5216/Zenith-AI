import React, { useState } from "react";
import type ZenithAI from "../../index";
import { DEFAULT_SETTINGS } from "../../settings";
import {
  ToggleSetting,
  TextInputSetting,
  TextAreaSetting,
  DropdownSetting,
  handleSettingChange,
} from "./components";

interface CustomizationTabProps {
  plugin: InstanceType<typeof ZenithAI>;
}

export const CustomizationTab: React.FC<CustomizationTabProps> = ({
  plugin,
}) => {
  const [enableFileRenaming, setEnableFileRenaming] = useState(
    plugin.settings.enableFileRenaming,
  );
  const [renameInstructions, setRenameInstructions] = useState(
    plugin.settings.renameInstructions,
  );
  const [useSimilarTags, setUseSimilarTags] = useState(
    plugin.settings.useSimilarTags,
  );
  const [useSimilarTagsInFrontmatter, setUseSimilarTagsInFrontmatter] =
    useState(plugin.settings.useSimilarTagsInFrontmatter);
  const [customFolderInstructions, setCustomFolderInstructions] = useState(
    plugin.settings.customFolderInstructions,
  );
  const [enableDocumentClassification, setEnableDocumentClassification] =
    useState(plugin.settings.enableDocumentClassification);
  const [customTagInstructions, setCustomTagInstructions] = useState(
    plugin.settings.customTagInstructions,
  );
  const [vertexBrainUrl, setVertexBrainUrl] = useState(
    plugin.settings.vertexBrainUrl ?? "",
  );
  const [enableVectorAutoSort, setEnableVectorAutoSort] = useState(
    plugin.settings.enableVectorAutoSort ?? false,
  );
  const [autoSortConfidenceThreshold, setAutoSortConfidenceThreshold] =
    useState(plugin.settings.autoSortConfidenceThreshold ?? 0.75);
  const [organizationRulesPath, setOrganizationRulesPath] = useState(
    plugin.settings.organizationRulesPath ?? "",
  );
  const [formatBehavior, setFormatBehavior] = useState(
    plugin.settings.formatBehavior || DEFAULT_SETTINGS.formatBehavior,
  );
  const [enableProcessingNotifications, setEnableProcessingNotifications] =
    useState(plugin.settings.enableProcessingNotifications ?? true);
  const [generalMergeThreshold, setGeneralMergeThreshold] = useState(
    plugin.settings.generalMergeThreshold ?? 0.5,
  );
  const [globalMergeThreshold, setGlobalMergeThreshold] = useState(
    plugin.settings.globalMergeThreshold ?? 0.7,
  );
  const [pinnedTag, setPinnedTag] = useState(
    plugin.settings.pinnedTag ?? "pinned",
  );
  const [projectsPath, setProjectsPath] = useState(
    plugin.settings.projectsPath ?? "Projects",
  );
  const [backgroundScribeOutputFile, setBackgroundScribeOutputFile] = useState(
    plugin.settings.backgroundScribeOutputFile ?? "TODO.md",
  );

  const handleNumberChange = async (
    value: number,
    setter: React.Dispatch<React.SetStateAction<number>>,
    settingKey: keyof typeof plugin.settings,
    options?: { min?: number; max?: number },
  ) => {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.min(
      options?.max ?? Infinity,
      Math.max(options?.min ?? -Infinity, value),
    );
    setter(nextValue);
    // nosemgrep: detect-object-injection
    (plugin.settings[settingKey] as number) = nextValue;
    await plugin.saveSettings();
  };

  return (
    <div className="p-4 space-y-8">
      {/* Inbox Processing Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-[#0fb6d6]">
          Inbox Processing
        </h3>
        <div className="bg-[#191621] p-4 rounded-lg mb-4 border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <div className="text-xs text-[#45aaff] opacity-70">
            These settings control how new files are automatically handled when
            they enter your vault through the inbox. Enable or disable automatic
            processing features and configure how the AI should handle your
            incoming documents.
          </div>
        </div>
        <div className="space-y-4">
          <ToggleSetting
            name="Inbox Auto-Renaming"
            description="Automatically rename new files when they are processed through the inbox."
            value={enableFileRenaming}
            onChange={value =>
              handleSettingChange(
                plugin,
                value,
                setEnableFileRenaming,
                "enableFileRenaming",
              )
            }
          />
          <ToggleSetting
            name="Inbox Auto-Formatting"
            description="Automatically format new documents when they match a template category during inbox processing."
            value={enableDocumentClassification}
            onChange={value =>
              handleSettingChange(
                plugin,
                value,
                setEnableDocumentClassification,
                "enableDocumentClassification",
              )
            }
          />
          <div className="bg-[#191621] p-4 rounded-lg mt-2 border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            <div className="font-medium text-[#bebebe] mb-2">
              Document Type Templates
            </div>
            <div className="text-xs text-[#45aaff] opacity-70">
              To enable auto-formatting, create template files in the Zenith-AI
              template folder. Name each file according to its document type
              (e.g., 'workout.md', 'meeting-notes.md'). The content of each file
              should contain the formatting instructions. You can manage these
              templates through the AI sidebar.
            </div>
          </div>
          <ToggleSetting
            name="Inbox Similar Tags"
            description="Automatically append similar tags to new files during inbox processing."
            value={useSimilarTags}
            onChange={value =>
              handleSettingChange(
                plugin,
                value,
                setUseSimilarTags,
                "useSimilarTags",
              )
            }
          />
          <ToggleSetting
            name="Processing Notifications"
            description="Show toast notifications during inbox file processing (bypass, error, and progress notices)."
            value={enableProcessingNotifications}
            onChange={value =>
              handleSettingChange(
                plugin,
                value,
                setEnableProcessingNotifications,
                "enableProcessingNotifications",
              )
            }
          />
        </div>
      </section>

      {/* General Settings Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-[#0fb6d6]">
          General Settings
        </h3>
        <div className="bg-[#191621] p-4 rounded-lg mb-4 border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <div className="text-xs text-[#45aaff] opacity-70">
            Configure how Zenith-AI behaves across your vault. These settings
            affect both manual operations and provide the base configuration for
            inbox processing. Customize naming conventions, tagging behavior,
            and folder organization to match your workflow.
          </div>
        </div>

        {/* File Naming subsection */}
        <div className="mb-6">
          <h4 className="font-medium text-[#bebebe] mb-2">
            File Naming
          </h4>
          <div className="space-y-4">
            <TextAreaSetting
              name="Rename Instructions"
              description="Instructions for how files should be renamed based on their content."
              value={renameInstructions}
              onChange={value =>
                handleSettingChange(
                  plugin,
                  value,
                  setRenameInstructions,
                  "renameInstructions",
                )
              }
            />
          </div>
        </div>

        {/* Tags subsection */}
        <div className="mb-6">
          <h4 className="font-medium text-[#bebebe] mb-2">Tags</h4>
          <div className="space-y-4">
            <ToggleSetting
              name="Use Frontmatter"
              description="Add similar tags in frontmatter instead of inline."
              value={useSimilarTagsInFrontmatter}
              onChange={value =>
                handleSettingChange(
                  plugin,
                  value,
                  setUseSimilarTagsInFrontmatter,
                  "useSimilarTagsInFrontmatter",
                )
              }
            />
            <TextAreaSetting
              name="Tag Generation Instructions"
              description="Custom instructions for generating tags for your notes."
              value={customTagInstructions}
              onChange={value =>
                handleSettingChange(
                  plugin,
                  value,
                  setCustomTagInstructions,
                  "customTagInstructions",
                )
              }
            />
          </div>
        </div>

        {/* Folder Section */}
        <div className="mb-6">
          <h4 className="font-medium text-[#bebebe] mb-2">
            Folder Organization
          </h4>
          <div className="space-y-4">
            <TextAreaSetting
              name="Custom Folder Determination Instructions"
              description="Provide custom instructions for determining which folders to place your notes in."
              value={customFolderInstructions}
              onChange={value =>
                handleSettingChange(
                  plugin,
                  value,
                  setCustomFolderInstructions,
                  "customFolderInstructions",
                )
              }
            />
            <TextInputSetting
              name="Pinned Tag"
              description="Files with this tag will be excluded from auto-sort. Leave empty to disable."
              value={pinnedTag}
              placeholder="pinned"
              onChange={value =>
                handleSettingChange(plugin, value, setPinnedTag, "pinnedTag")
              }
            />
          </div>
        </div>

        {/* Formatting subsection */}
        <div className="mb-6">
          <h4 className="font-medium text-[#bebebe] mb-2">
            Formatting
          </h4>
          <div className="space-y-4">
            <DropdownSetting
              name="Format Behavior"
              description="How formatted content is applied to your documents."
              value={formatBehavior}
              options={[
                { value: "override", label: "Replace" },
                { value: "newFile", label: "New File" },
                { value: "append", label: "Append" },
              ]}
              onChange={value =>
                handleSettingChange(
                  plugin,
                  value as "override" | "newFile" | "append",
                  setFormatBehavior,
                  "formatBehavior",
                )
              }
            />
          </div>
        </div>
      </section>

      {/* Vault Intelligence Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-[#0fb6d6]">
          Vault Intelligence
        </h3>
        <div className="bg-[#191621] rounded-lg mb-4 p-4 border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <div className="text-xs text-[#45aaff] opacity-70">
            Semantic auto-sorting powered by your Vertex AI Brain
          </div>
        </div>
        <div className="space-y-4">
          <TextInputSetting
            name="Vertex Brain URL"
            description="URL of your Vertex AI Brain gateway (leave empty to disable)"
            value={vertexBrainUrl}
            placeholder="http://localhost:8085"
            onChange={async value => {
              setVertexBrainUrl(value);
              (plugin.settings.vertexBrainUrl as string) = value;
              await plugin.saveSettings();
            }}
          />
          <ToggleSetting
            name="Enable Vector Auto-Sort"
            description="Automatically route General files using semantic embeddings"
            value={enableVectorAutoSort}
            onChange={value =>
              handleSettingChange(
                plugin,
                value,
                setEnableVectorAutoSort,
                "enableVectorAutoSort",
              )
            }
          />
          <NumberInputSetting
            name="Auto-Sort Confidence Threshold"
            description="Minimum confidence (0–1) to auto-sort without showing suggestion UI. Default: 0.75"
            value={autoSortConfidenceThreshold}
            min={0}
            max={1}
            step={0.05}
            onChange={value =>
              handleNumberChange(
                value,
                setAutoSortConfidenceThreshold,
                "autoSortConfidenceThreshold",
                { min: 0, max: 1 },
              )
            }
          />
          <NumberInputSetting
            name="General Merge Threshold"
            description="Confidence threshold (0–1) for auto-sorting files from the General directory into Projects. Default: 0.50"
            value={generalMergeThreshold}
            min={0}
            max={1}
            step={0.05}
            onChange={value =>
              handleNumberChange(
                value,
                setGeneralMergeThreshold,
                "generalMergeThreshold",
                { min: 0, max: 1 },
              )
            }
          />
          <NumberInputSetting
            name="Global Merge Threshold"
            description="Confidence threshold (0–1) for auto-sorting files from non-General, non-Project locations. Default: 0.70"
            value={globalMergeThreshold}
            min={0}
            max={1}
            step={0.05}
            onChange={value =>
              handleNumberChange(
                value,
                setGlobalMergeThreshold,
                "globalMergeThreshold",
                { min: 0, max: 1 },
              )
            }
          />
          <TextInputSetting
            name="Projects Path"
            description="Root folder used for project detection during auto-sort and Background Scribe. Default: Projects"
            value={projectsPath}
            placeholder="Projects"
            onChange={value => {
              // Don't sanitize during typing - just update state
              setProjectsPath(value);
            }}
            onBlur={async () => {
              // Sanitize on blur/save
              const sanitized =
                projectsPath.trim().replace(/^\/+|\/+$/g, "") || "Projects";
              setProjectsPath(sanitized);
              await handleSettingChange(
                plugin,
                sanitized,
                setProjectsPath,
                "projectsPath",
              );
            }}
          />
          <TextInputSetting
            name="Cosmic Vault Structure Path"
            description="Path to the note that defines your Cosmic Vault Structure"
            value={organizationRulesPath}
            placeholder="System/Cosmic Vault Structure.md"
            onChange={async value => {
              setOrganizationRulesPath(value);
              (plugin.settings.organizationRulesPath as string) = value;
              await plugin.saveSettings();
            }}
          />
        </div>
      </section>

      {/* Background Scribe Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-[#0fb6d6]">
          Background Scribe
        </h3>
        <div className="bg-[#191621] rounded-lg mb-4 p-4 border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <div className="text-xs text-[#45aaff] opacity-70">
            Background Scribe buffers chat conversations and synthesizes
            actionable TODO items into a file. Toggle it on/off from the AI chat
            panel.
          </div>
        </div>
        <div className="space-y-4">
          <TextInputSetting
            name="Scribe Output File"
            description="File path where Background Scribe writes synthesized TODO items. Default: TODO.md"
            value={backgroundScribeOutputFile}
            placeholder="TODO.md"
            onChange={value => {
              // Don't sanitize during typing - just update state
              setBackgroundScribeOutputFile(value);
            }}
            onBlur={async () => {
              // Sanitize on blur/save
              const sanitized =
                backgroundScribeOutputFile.trim().replace(/^\/+|\/+$/g, "") ||
                "TODO.md";
              setBackgroundScribeOutputFile(sanitized);
              await handleSettingChange(
                plugin,
                sanitized,
                setBackgroundScribeOutputFile,
                "backgroundScribeOutputFile",
              );
            }}
          />
        </div>
      </section>
    </div>
  );
};

interface NumberInputSettingProps {
  name: string;
  description: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

const NumberInputSetting: React.FC<NumberInputSettingProps> = ({
  name,
  description,
  value,
  min,
  max,
  step,
  onChange,
}) => (
  <div className="py-2">
    <div className="font-medium text-[#bebebe]">
      {name}
    </div>
    <div className="text-xs text-[#45aaff] mb-1 opacity-75">
      {description}
    </div>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-24 px-3 py-2 text-xs rounded-md bg-[#0d0b12] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] transition-all duration-150"
    />
  </div>
);
