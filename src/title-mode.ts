// Title-mode: per-canvas attach, scan nodes, render title text in an overlay div.

import { TFile } from "obsidian";
import { resolveTitle, stripFrontmatter } from "./title";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

const DATA_ENABLED = "data-cnt-title-mode";
const OVERLAY_CLASS = "cnt-title-overlay";

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

    // Re-render titles when the file changes externally.
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
    const existing = el.querySelector(`:scope > .${OVERLAY_CLASS}`) as HTMLElement | null;

    if (!enabled) {
      el.removeAttribute(DATA_ENABLED);
      existing?.remove();
      return;
    }

    el.setAttribute(DATA_ENABLED, "true");
    const overlay = existing ?? this.createOverlay(el);
    // Don't replace text while the overlay is being edited — it would clobber
    // the user's input and can re-trigger blur, leading to an event loop.
    if (overlay.classList.contains("cnt-editing")) return;
    const title = await this.resolveForFile(file as TFile);
    overlay.textContent = title;
  }

  private createOverlay(parent: HTMLElement): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    parent.appendChild(overlay);
    return overlay;
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
