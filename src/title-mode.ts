// Title-mode: per-canvas attach, scan nodes, render title text via data attributes.

import { TFile } from "obsidian";
import { resolveTitle, stripFrontmatter } from "./title";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

const DATA_ENABLED = "data-cnt-title-mode";
const DATA_TEXT = "data-cnt-title-text";

export class TitleModeFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    const flag = canvas as unknown as { _cntTitleAttached?: boolean };
    if (flag._cntTitleAttached) {
      this.applyAll(canvas);
      return;
    }
    flag._cntTitleAttached = true;
    this.applyAll(canvas);

    // Re-render titles when the file changes externally (frontmatter or first line).
    const evt = this.plugin.app.metadataCache.on("changed", (file) => {
      for (const [, node] of canvas.nodes) {
        if (this.fileForNode(node)?.path === file.path) {
          void this.applyToNode(node);
        }
      }
    });
    this.plugin.registerEvent(evt);
  }

  applyAll(canvas: CanvasMin): void {
    for (const [, node] of canvas.nodes) {
      void this.applyToNode(node);
    }
  }

  async applyToNode(node: CanvasNodeMin): Promise<void> {
    const data = node.getData();
    const file = this.fileForNode(node);
    const enabled = data.titleMode !== false && data.type === "file" && file !== null;
    const el = node.nodeEl;
    const inner = el.querySelector(".canvas-node-content") as HTMLElement | null;

    if (!enabled) {
      el.removeAttribute(DATA_ENABLED);
      el.removeAttribute(DATA_TEXT);
      inner?.removeAttribute(DATA_TEXT);
      return;
    }

    el.setAttribute(DATA_ENABLED, "true");
    const title = await this.resolveForFile(file as TFile);
    el.setAttribute(DATA_TEXT, title);
    inner?.setAttribute(DATA_TEXT, title);
  }

  private fileForNode(node: CanvasNodeMin): TFile | null {
    const data = node.getData();
    if (data.type !== "file" || !data.file) return null;
    const f = this.plugin.app.vault.getAbstractFileByPath(data.file as string);
    return f instanceof TFile ? f : null;
  }

  private async resolveForFile(file: TFile): Promise<string> {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};
    const content = await this.plugin.app.vault.cachedRead(file);
    const body = stripFrontmatter(content);
    return resolveTitle({ basename: file.basename, frontmatter: fm, body });
  }
}
