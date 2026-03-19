import { WorkspaceLeaf } from "obsidian";
import ZenithAI from "../index";
import { ORGANIZER_VIEW_TYPE, AssistantViewWrapper } from "../views/assistant/view";

export function initializeOrganizer(plugin: ZenithAI) {
  plugin.registerView(
    ORGANIZER_VIEW_TYPE,
    (leaf: WorkspaceLeaf) => new AssistantViewWrapper(leaf, plugin)
  );

  plugin.addRibbonIcon("sparkle", "Zenith-AI", () => {
    plugin.ensureAssistantView();
  });
}
