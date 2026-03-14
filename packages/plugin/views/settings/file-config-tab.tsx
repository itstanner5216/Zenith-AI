import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";
import { cleanPath } from "../../someUtils";
import { normalizePath, Modal, Notice } from "obsidian";
import { Search, X } from "lucide-react";
import { logger } from "../../services/logger";
interface FileConfigTabProps {
  plugin: ZenithAI;
}

export const FileConfigTab: React.FC<FileConfigTabProps> = ({ plugin }) => {
  const [pathToWatch, setPathToWatch] = useState(plugin.settings.pathToWatch);
  const [attachmentsPath, setAttachmentsPath] = useState(
    plugin.settings.attachmentsPath
  );
  const [logFolderPath, setLogFolderPath] = useState(
    plugin.settings.logFolderPath
  );
  const [defaultDestinationPath, setDefaultDestinationPath] = useState(
    plugin.settings.defaultDestinationPath
  );
  const [ignoreFolders, setIgnoreFolders] = useState(
    plugin.settings.ignoreFolders.join(",")
  );
  const [backupFolderPath, setBackupFolderPath] = useState(
    plugin.settings.backupFolderPath
  );
  const [templatePaths, setTemplatePaths] = useState(
    plugin.settings.templatePaths
  );
  const [bypassedFilePath, setBypassedFilePath] = useState(
    plugin.settings.bypassedFilePath
  );
  const [errorFilePath, setErrorFilePath] = useState(
    plugin.settings.errorFilePath
  );
  const [recordingsFolderPath, setRecordingsFolderPath] = useState(
    plugin.settings.recordingsFolderPath
  );

  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [pathExistence, setPathExistence] = useState<Record<string, boolean>>(
    {}
  );

  const FolderList = React.memo(() => {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "active" | "ignored">(
      "active"
    );

    const allFolders = plugin.app.vault.getAllFolders();
    const availableFolders = plugin.getAllUserFolders();
    const ignoredFolders = plugin.getAllIgnoredFolders();

    const getFilteredFolders = () => {
      let folders = availableFolders;

      switch (filterType) {
        case "all":
          folders = allFolders.map(folder => folder.path);
          break;
        case "active":
          folders = availableFolders;
          break;
        case "ignored":
          folders = ignoredFolders;
          break;
        default:
          folders = availableFolders;
      }

      return folders.filter(folder =>
        folder.toLowerCase().includes(searchQuery.toLowerCase())
      );
    };

    const filteredFolders = getFilteredFolders();

    return (
      <div className="mb-8 p-4 bg-[var(--bg-depth-3)] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-[var(--border-defined)]">
        <div className="mb-4">
          <p className="text-sm text-[var(--text-dim)] opacity-70 mb-3">
            Use the search box to verify folder accessibility
          </p>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-defined)]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterType === "all"
                  ? "border-[var(--text-accent)] text-[var(--text-accent)]"
                  : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-accent)] hover:border-[var(--border-defined)]"
              }`}
            >
              All Folders
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterType === "all"
                    ? "bg-[var(--text-accent)] text-[var(--bg-depth-1)]"
                    : "bg-[rgba(14,210,247,0.08)] text-[var(--text-dim)]"
                }`}
              >
                {allFolders.length}
              </span>
            </button>
            <button
              onClick={() => setFilterType("active")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterType === "active"
                  ? "border-[var(--text-accent)] text-[var(--text-accent)]"
                  : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-accent)] hover:border-[var(--border-defined)]"
              }`}
            >
              Active Paths
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterType === "active"
                    ? "bg-[var(--text-accent)] text-[var(--bg-depth-1)]"
                    : "bg-[rgba(14,210,247,0.08)] text-[var(--text-dim)]"
                }`}
              >
                {availableFolders.length}
              </span>
            </button>
            <button
              onClick={() => setFilterType("ignored")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterType === "ignored"
                  ? "border-[var(--text-accent)] text-[var(--text-accent)]"
                  : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-accent)] hover:border-[var(--border-defined)]"
              }`}
            >
              Ignored Paths
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterType === "ignored"
                    ? "bg-[var(--text-accent)] text-[var(--bg-depth-1)]"
                    : "bg-[rgba(14,210,247,0.08)] text-[var(--text-dim)]"
                }`}
              >
                {ignoredFolders.length}
              </span>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-depth-1)] border border-[var(--border-defined)] rounded-md focus-within:border-[var(--text-accent)] focus-within:ring-1 focus-within:ring-[var(--text-accent)]">
            <Search className="w-4 h-4 text-[var(--text-dim)] shrink-0" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-[var(--text-normal)] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="shrink-0 flex items-center justify-center p-1 text-[var(--text-dim)] hover:text-[var(--text-accent)] transition-colors duration-150 cursor-pointer rounded hover:bg-[rgba(14,210,247,0.04)]"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 stroke-current" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[240px] overflow-y-auto border border-[var(--border-defined)] rounded-md bg-[var(--bg-depth-1)]">
          {filteredFolders.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5">
              {filteredFolders.map(folder => (
                <div
                  key={folder}
                  className="px-3 py-2 text-[var(--text-normal)] text-sm hover:bg-[rgba(14,210,247,0.04)] cursor-default truncate"
                  title={folder}
                >
                  {folder}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-[var(--text-dim)]">
              {searchQuery
                ? "No matching folders found"
                : "No available folders"}
            </div>
          )}
        </div>
      </div>
    );
  });

  const handleSettingChange = async (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    settingKey: keyof typeof plugin.settings
  ) => {
    setter(value);
    (plugin.settings as any)[settingKey] = value;
    await plugin.saveSettings();
  };

  const handleIgnoreFoldersChange = async (value: string) => {
    setIgnoreFolders(value);
    const trimmedValue = value.trim();
    if (trimmedValue === "*") {
      plugin.settings.ignoreFolders = ["*"];
    } else {
      plugin.settings.ignoreFolders = trimmedValue.split(",");
    }
    await plugin.saveSettings();
  };

  const checkPathExistence = async (path: string): Promise<boolean> => {
    try {
      const normalizedPath = normalizePath(path);
      const exists = await plugin.app.vault.adapter.exists(normalizedPath);
      return exists;
    } catch (error) {
      logger.error(`Error checking path existence: ${error}`);
      return false;
    }
  };

  const createFolder = async (path: string) => {
    try {
      const normalizedPath = normalizePath(path);
      await plugin.app.vault.createFolder(normalizedPath);
      return true;
    } catch (error) {
      logger.error(`Error creating folder: ${error}`);
      return false;
    }
  };

  useEffect(() => {
    const checkPaths = async () => {
      const pathsToCheck = [
        pathToWatch,
        attachmentsPath,
        logFolderPath,
        defaultDestinationPath,
        backupFolderPath,
        templatePaths,
        bypassedFilePath,
        errorFilePath,
      ];

      const existenceResults = await Promise.all(
        pathsToCheck.map(async path => [path, await checkPathExistence(path)])
      );

      setPathExistence(Object.fromEntries(existenceResults));
    };

    checkPaths();
  }, [
    pathToWatch,
    attachmentsPath,
    logFolderPath,
    defaultDestinationPath,
    backupFolderPath,
    templatePaths,
    bypassedFilePath,
    errorFilePath,
  ]);

  useEffect(() => {
    const newWarnings: Record<string, string> = {};

    const checkPath = (path: string, key: string) => {
      if (path && cleanPath(path) !== path) {
        newWarnings[key] =
          "Path may contain leading/trailing slashes or spaces. Consider cleaning it.";
      }
    };

    checkPath(pathToWatch, "pathToWatch");
    checkPath(attachmentsPath, "attachmentsPath");
    checkPath(logFolderPath, "logFolderPath");
    checkPath(defaultDestinationPath, "defaultDestinationPath");
    checkPath(backupFolderPath, "backupFolderPath");
    checkPath(templatePaths, "templatePaths");
    checkPath(bypassedFilePath, "bypassedFilePath");
    checkPath(errorFilePath, "errorFilePath");

    // Special check for ignoreFolders
    if (ignoreFolders !== "*") {
      const folders = ignoreFolders.split(",");
      if (folders.some(folder => cleanPath(folder) !== folder.trim())) {
        newWarnings["ignoreFolders"] =
          "Some folder paths may contain leading/trailing slashes or spaces.";
      }
    }

    setWarnings(newWarnings);
  }, [
    pathToWatch,
    attachmentsPath,
    logFolderPath,
    defaultDestinationPath,
    ignoreFolders,
    backupFolderPath,
    templatePaths,
    bypassedFilePath,
    errorFilePath,
  ]);

  const renderSettingItem = (
    name: string,
    description: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    settingKey: string
  ) => (
    <div className="setting-item">
      <div className="setting-item-info">
        <div className="setting-item-name">{name}</div>
        <div className="setting-item-description">{description}</div>
        {warnings[settingKey] && (
          <div className="mt-1 text-xs text-[var(--text-warning)] flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(255,183,77,0.3)' }}>
            <span>⚠</span> {warnings[settingKey]}
          </div>
        )}
        {pathExistence[value] === false && (
          <div className="mt-1 text-xs text-[var(--text-sub-accent)] flex items-center gap-2">
            <span>Path does not exist.</span>
            <button
              onClick={async () => {
                const created = await createFolder(value);
                if (created) {
                  setPathExistence({ ...pathExistence, [value]: true });
                }
              }}
              className="px-2 py-0.5 text-xs rounded border border-[var(--border-accent)] text-[var(--text-accent)] hover:bg-[rgba(14,210,247,0.08)] transition-all duration-150"
            >
              Create folder
            </button>
          </div>
        )}
      </div>
      <div className="setting-item-control">
        <input
          type="text"
          placeholder="Enter your path"
          value={value}
          onChange={onChange}
          className="w-full bg-[var(--bg-depth-1)] text-[var(--text-normal)] text-xs border border-[var(--border-defined)] rounded-md px-3 py-1.5 focus:outline-none focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-accent)] focus:shadow-[0_0_8px_rgba(14,210,247,0.1)] transition-all duration-150 placeholder:text-[var(--text-dim)] placeholder:opacity-60"
        />
      </div>
    </div>
  );

  return (
    <div className="file-config-settings">
      <div className="mb-8">
        <p className="text-[var(--text-dim)] mb-4">
          Configure which folders File Organizer can manage and monitor. This
          helps you:
        </p>
        <ul className="list-disc pl-6 text-[var(--text-dim)] space-y-1 mb-6">
          <li>Define which folders to watch for new files</li>
          <li>Set up ignored paths to exclude from organization</li>
          <li>Manage attachment and backup locations</li>
          <li>Configure template and pattern directories</li>
        </ul>
        <div className="p-4 bg-[var(--bg-depth-2)] rounded-lg border border-[var(--border-defined)]">
          <p className="text-sm text-[var(--text-accent)]">
            💡 Tip: Use the folder overview below to understand your vault
            structure and verify your path configurations.
          </p>
        </div>
      </div>

      <FolderList key={Object.values(plugin.settings).join(",")} />

      <div className="border-t border-[var(--border-defined)] ">
        <h3 className="mb-4 text-lg font-semibold text-[var(--text-accent)]">
          Path Configuration
        </h3>
        {renderSettingItem(
          "Inbox folder",
          "Choose which folder to automatically organize files from",
          pathToWatch,
          e =>
            handleSettingChange(e.target.value, setPathToWatch, "pathToWatch"),
          "pathToWatch"
        )}
        {renderSettingItem(
          "Attachments folder",
          "Enter the path to the folder where the original images will be moved.",
          attachmentsPath,
          e =>
            handleSettingChange(
              e.target.value,
              setAttachmentsPath,
              "attachmentsPath"
            ),
          "attachmentsPath"
        )}
        {renderSettingItem(
          "File Organizer log folder",
          "Choose a folder for Organization Logs e.g. Ava/Logs.",
          logFolderPath,
          e =>
            handleSettingChange(
              e.target.value,
              setLogFolderPath,
              "logFolderPath"
            ),
          "logFolderPath"
        )}
        {renderSettingItem(
          "Output folder path",
          "Enter the path where you want to save the processed files. e.g. Processed/myfavoritefolder",
          defaultDestinationPath,
          e =>
            handleSettingChange(
              e.target.value,
              setDefaultDestinationPath,
              "defaultDestinationPath"
            ),
          "defaultDestinationPath"
        )}
        {renderSettingItem(
          "Ignore folders",
          "Enter folder paths to ignore during organization, separated by commas(e.g. Folder1,Folder2). Or * to ignore all folders",
          ignoreFolders,
          e => handleIgnoreFoldersChange(e.target.value),
          "ignoreFolders"
        )}
        {renderSettingItem(
          "Backup folder",
          "Choose a folder for file backups.",
          backupFolderPath,
          e =>
            handleSettingChange(
              e.target.value,
              setBackupFolderPath,
              "backupFolderPath"
            ),
          "backupFolderPath"
        )}
        {renderSettingItem(
          "Templates folder",
          "Choose a folder for document templates.",
          templatePaths,
          e =>
            handleSettingChange(
              e.target.value,
              setTemplatePaths,
              "templatePaths"
            ),
          "templatePaths"
        )}
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Restore Default Templates</div>
            <div className="setting-item-description">
              Restore the default plugin templates (meeting_note.md, enhance.md, research_paper.md, flash_cards.md) to their original versions. Your custom templates will not be affected.
            </div>
          </div>
          <div className="setting-item-control">
            <button
              onClick={async () => {
                const confirmed = await new Promise<boolean>(resolve => {
                  class RestoreTemplatesModal extends Modal {
                    onOpen() {
                      const { contentEl } = this;
                      contentEl.empty();
                      contentEl.createEl("h2", { text: "Restore Default Templates" });
                      contentEl.createEl("p", {
                        text: "This will restore the following templates to their original plugin versions:",
                      });
                      const list = contentEl.createEl("ul");
                      list.createEl("li", { text: "meeting_note.md" });
                      list.createEl("li", { text: "enhance.md" });
                      list.createEl("li", { text: "research_paper.md" });
                      list.createEl("li", { text: "flash_cards.md" });
                      contentEl.createEl("p", {
                        text: "Your custom templates will not be affected.",
                        attr: { style: "margin-top: 1em; font-weight: bold;" },
                      });
                      const buttonContainer = contentEl.createDiv({
                        attr: { style: "display: flex; gap: 10px; margin-top: 1em;" },
                      });
                      buttonContainer
                        .createEl("button", { text: "Cancel" })
                        .addEventListener("click", () => {
                          resolve(false);
                          this.close();
                        });
                      buttonContainer
                        .createEl("button", {
                          text: "Restore",
                          attr: { style: "background: var(--text-accent); color: var(--bg-depth-1);" },
                        })
                        .addEventListener("click", () => {
                          resolve(true);
                          this.close();
                        });
                    }
                  }
                  const modal = new RestoreTemplatesModal(plugin.app);
                  modal.open();
                });

                if (confirmed) {
                  try {
                    await plugin.restoreTemplates();
                  } catch (error) {
                    // Error is already handled in restoreTemplates method
                  }
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-[var(--text-accent)] text-[var(--bg-depth-1)] rounded-md border border-[var(--text-accent)] hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)] cursor-pointer"
            >
              Restore Default Templates
            </button>
          </div>
        </div>
        {renderSettingItem(
          "Bypassed notes path",
          "Choose a folder for bypassed notes.",
          bypassedFilePath,
          e =>
            handleSettingChange(
              e.target.value,
              setBypassedFilePath,
              "bypassedFilePath"
            ),
          "bypassedFilePath"
        )}
        {renderSettingItem(
          "Error notes path",
          "Choose a folder for error notes.",
          errorFilePath,
          e =>
            handleSettingChange(
              e.target.value,
              setErrorFilePath,
              "errorFilePath"
            ),
          "errorFilePath"
        )}
        {renderSettingItem(
          "Recordings folder",
          "Choose a folder for meeting recordings.",
          recordingsFolderPath,
          e =>
            handleSettingChange(
              e.target.value,
              setRecordingsFolderPath,
              "recordingsFolderPath"
            ),
          "recordingsFolderPath"
        )}
      </div>
    </div>
  );
};
