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
  // Inbox commands removed — no more pathToWatch setting
}
