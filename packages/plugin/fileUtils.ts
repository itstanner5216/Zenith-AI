import { App, TFolder, TFile, normalizePath, parseYaml } from "obsidian";
import { logger } from "./services/logger";

export async function ensureFolderExists(app: App, folderPath: string) {
  if (!(await app.vault.adapter.exists(folderPath))) {
    await app.vault.createFolder(folderPath);
  }
}

/**
 * @deprecated use safeMove instead
 */
export async function moveFile(
  app: App,
  sourceFile: TFile,
  newFileName: string,
  destinationFolder = ""
): Promise<TFile> {
  const fileExtension = sourceFile.extension;

  let targetPath = `${destinationFolder}/${newFileName}.${fileExtension}`;
  const normalizedTargetPath = normalizePath(targetPath);

  if (await app.vault.adapter.exists(normalizedTargetPath)) {
    const timestamp = Date.now();
    const uniqueFileName = `${newFileName}_${timestamp}`;
    targetPath = `${destinationFolder}/${uniqueFileName}.${fileExtension}`;
  }

  const normalizedFinalPath = normalizePath(targetPath);

  await ensureFolderExists(app, destinationFolder);

  await app.fileManager.renameFile(sourceFile, normalizedFinalPath);

  const movedFile = app.vault.getAbstractFileByPath(
    normalizedFinalPath
  ) as TFile;
  return movedFile;
}

export function isTFolder(file: any): file is TFolder {
  return file instanceof TFolder;
}

export function getAllFolders(app: App): string[] {
  const allFiles = app.vault.getAllLoadedFiles();
  const folderPaths = allFiles
    .filter(file => isTFolder(file))
    .map(folder => folder.path);

  return [...new Set(folderPaths)];
}

export async function getAvailablePath(
  app: App,
  desiredPath: string
): Promise<string> {
  let available = desiredPath;
  let increment = 0;

  while (await app.vault.adapter.exists(available)) {
    increment++;
    const lastDotIndex = available.lastIndexOf(".");
    const withoutExt = available.slice(0, lastDotIndex);
    const ext = available.slice(lastDotIndex);
    available = `${withoutExt} ${increment}${ext}`;
  }

  return available;
}

export async function safeCreate(
  app: App,
  desiredPath: string,
  content = ""
): Promise<TFile> {
  const parentPath = desiredPath.substring(0, desiredPath.lastIndexOf("/"));
  await ensureFolderExists(app, parentPath);

  const availablePath = await getAvailablePath(app, desiredPath);
  return await app.vault.create(availablePath, content);
}

export async function safeRename(
  app: App,
  file: TFile,
  newName: string
): Promise<void> {
  const parentPath = file.parent?.path ?? "";
  const extension = file.extension;
  const desiredPath = `${parentPath}/${newName}.${extension}`;

  const availablePath = await getAvailablePath(app, desiredPath);
  await app.fileManager.renameFile(file, availablePath);
}

export async function safeCopy(
  app: App,
  file: TFile,
  destinationPath: string
): Promise<TFile> {
  await ensureFolderExists(app, destinationPath);

  const desiredPath = `${destinationPath}/${file.name}`;
  const availablePath = await getAvailablePath(app, desiredPath);
  return await app.vault.copy(file, availablePath);
}

export async function safeMove(
  app: App,
  file: TFile,
  destinationPath: string
): Promise<string> {
  await ensureFolderExists(app, destinationPath);

  const desiredPath = `${destinationPath}/${file.name}`;
  const availablePath = await getAvailablePath(app, desiredPath);
  await app.fileManager.renameFile(file, availablePath);
  return availablePath;
}

export async function sanitizeContent(content: string): Promise<string> {
  try {
    if (!content || typeof content !== "string") {
      return "";
    }

    const lines = content.split("\n");
    let inFrontmatter = false;
    let validContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === "---") {
        if (i === 0 || (i === 1 && !validContent.length)) {
          inFrontmatter = true;
          validContent.push(line);
          continue;
        } else if (inFrontmatter) {
          inFrontmatter = false;
          validContent.push(line);
          continue;
        }
      }

      if (inFrontmatter) {
        validContent.push(line);
      } else {
        const sanitizedLine = line
          .replace(/\0/g, "")
          .replace(/\u202E/g, "")
          .replace(/^\ufeff/g, "")
          .replace(/\r/g, "");

        validContent.push(sanitizedLine);
      }
    }

    if (inFrontmatter) {
      validContent.push("---");
    }

    return validContent.join("\n");
  } catch (error) {
    logger.error("Error sanitizing content:", error);
    return content;
  }
}

export async function safeModifyContent(
  app: App,
  file: TFile,
  content: string
): Promise<void> {
  try {
    const sanitizedContent = await sanitizeContent(content);

    if (sanitizedContent.trim().startsWith("---")) {
      const parts = sanitizedContent.split(/^---\s*$/m);

      if (parts.length >= 3) {
        try {
          const frontmatter = parseYaml(parts[1]);

          await app.fileManager.processFrontMatter(file, fm => {
            Object.assign(fm, frontmatter);
          });

          await app.vault.modify(file, sanitizedContent);
          return;
        } catch (e) {
          logger.debug("Frontmatter parsing failed:", e);
          await app.vault.modify(file, sanitizedContent);
          return;
        }
      }
    }

    await app.vault.modify(file, sanitizedContent);
  } catch (error) {
    logger.error("Error in safeModifyContent:", error);
    throw error;
  }
}
