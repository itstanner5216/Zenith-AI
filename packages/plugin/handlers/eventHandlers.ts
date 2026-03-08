import { Notice, TFile } from "obsidian";
import FileOrganizer from "..";
import { Inbox } from "../inbox";
import { VALID_MEDIA_EXTENSIONS } from "../constants";

function isInInboxFolder(filePath: string, pathToWatch: string): boolean {
  if (!pathToWatch) return false;
  return (
    filePath === pathToWatch || filePath.startsWith(pathToWatch + "/")
  );
}

export function registerEventHandlers(plugin: FileOrganizer) {
  plugin.registerEvent(
    plugin.app.vault.on("create", async file => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!isInInboxFolder(file.path, plugin.settings.pathToWatch)) return;
      if (file instanceof TFile) {
        new Notice("Inbox is looking at new file: " + file.basename);
        Inbox.getInstance().enqueueFiles([file]);
      }
    })
  );

  plugin.registerEvent(
    plugin.app.vault.on("rename", async (file, _oldPath) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!isInInboxFolder(file.path, plugin.settings.pathToWatch)) return;
      if (file instanceof TFile) {
        new Notice("Inbox is looking at new file: " + file.basename);
        Inbox.getInstance().enqueueFiles([file]);
      }
    })
  );

  plugin.registerEvent(
    plugin.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile)) return;
      if (!isInInboxFolder(file.path, plugin.settings.pathToWatch)) return;
      if (!VALID_MEDIA_EXTENSIONS.includes(file.extension)) return;
      Inbox.getInstance().enqueueFiles([file]);
    })
  );
}
