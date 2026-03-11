import { WorkspaceLeaf } from "obsidian";
import ZenithAI from "../index";
import { ORGANIZER_VIEW_TYPE, AssistantViewWrapper } from "../views/assistant/view";
import { App } from "obsidian";

export function initializeOrganizer(plugin: ZenithAI) {
  plugin.registerView(
    ORGANIZER_VIEW_TYPE,
    (leaf: WorkspaceLeaf) => new AssistantViewWrapper(leaf, plugin)
  );

  plugin.addRibbonIcon("sparkle", "Zenith-AI", () => {
    plugin.ensureAssistantView();
  });
}

export function initializeFileOrganizationCommands(plugin: ZenithAI) {
  plugin.addCommand({
    id: "add-to-inbox",
    name: "Put in inbox",
    callback: async () => {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile) {
        await plugin.app.vault.rename(activeFile, `${plugin.settings.pathToWatch}/${activeFile.name}`);
      }
    },
  });
}
