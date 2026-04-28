// Convert a selected text node into a real .md file in the canvas's directory.

import { Notice, TFile } from "obsidian";
import { sanitizeFilename, uniqueFilename } from "./sanitize";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export async function convertTextNodeToFile(
  plugin: CanvasNodesToolsPlugin,
  canvas: CanvasMin,
  node: CanvasNodeMin,
): Promise<void> {
  const data = node.getData();
  if (data.type !== "text") {
    new Notice("Only text nodes can be converted");
    return;
  }
  const text = (data.text ?? "").trim();
  if (text.length === 0) {
    new Notice("Empty text node — type something first");
    return;
  }

  const lines = text.split("\n");
  const firstLineIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLine = lines[firstLineIdx]?.trim() ?? "";
  const cleanedTitle = firstLine.replace(/^#+\s*/, "").trim();

  const slug = sanitizeFilename(cleanedTitle);
  const canvasFile = canvas.view?.file;
  if (!canvasFile) {
    new Notice("Couldn't determine the canvas file path");
    return;
  }
  const dir = canvasFile.parent?.path ?? "";

  const taken = new Set<string>();
  const folder = plugin.app.vault.getFolderByPath(dir);
  if (folder) {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        taken.add(child.basename);
      }
    }
  }
  const finalSlug = uniqueFilename(slug, taken);
  const targetPath = dir.length > 0 ? `${dir}/${finalSlug}.md` : `${finalSlug}.md`;

  const restBody = lines.slice(firstLineIdx + 1).join("\n").trim();
  const initial = [
    "---",
    `node_title: "${cleanedTitle.replace(/"/g, '\\"')}"`,
    "---",
    "",
    `# ${cleanedTitle}`,
    restBody.length > 0 ? `\n${restBody}` : "",
  ].join("\n");

  const newFile = await plugin.app.vault.create(targetPath, initial);

  node.setData({
    ...data,
    type: "file",
    file: newFile.path,
    text: undefined,
  });

  void plugin.titleModeFeature.applyToNode(node);
  canvas.requestSave?.();
  new Notice(`Created ${newFile.path}`);
}
