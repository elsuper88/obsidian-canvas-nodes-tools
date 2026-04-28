// Convert a selected text node into a real .md file in the canvas's directory.

import { Notice } from "obsidian";
import { sanitizeFilename } from "./sanitize";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

async function findAvailablePath(
  plugin: CanvasNodesToolsPlugin,
  dir: string,
  baseSlug: string,
): Promise<string> {
  const buildPath = (slug: string) =>
    dir.length > 0 && dir !== "/" ? `${dir}/${slug}.md` : `${slug}.md`;

  let attempt = baseSlug;
  let i = 2;
  // Limit to 1000 iterations defensively
  while (i < 1000) {
    const candidate = buildPath(attempt);
    if (!plugin.app.vault.getAbstractFileByPath(candidate)) return candidate;
    attempt = `${baseSlug} ${i}`;
    i++;
  }
  throw new Error("Couldn't find an available filename");
}

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

  const targetPath = await findAvailablePath(plugin, dir, slug);

  const restBody = lines.slice(firstLineIdx + 1).join("\n").trim();
  const yamlValue = JSON.stringify(cleanedTitle);
  const initial = [
    "---",
    `node_title: ${yamlValue}`,
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
