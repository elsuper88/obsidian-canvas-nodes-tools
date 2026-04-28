// Intercept dblclick on a file node's embed header to open the note in a new tab.

import { TFile } from "obsidian";
import type { CanvasMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export class HeaderLinkFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    const flag = canvas as unknown as { _cntHeaderAttached?: boolean };
    if (flag._cntHeaderAttached) return;
    flag._cntHeaderAttached = true;

    this.plugin.registerDomEvent(
      canvas.wrapperEl,
      "dblclick",
      (event) => this.onDblClick(event),
      { capture: true },
    );
  }

  private onDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const linkEl = target.closest(
      ".markdown-embed-link, .canvas-node-label",
    ) as HTMLElement | null;
    if (!linkEl) return;

    const nodeEl = linkEl.closest(".canvas-node") as HTMLElement | null;
    if (!nodeEl) return;

    const href =
      linkEl.getAttribute("href") ??
      linkEl.getAttribute("data-href") ??
      nodeEl.getAttribute("data-href");
    if (!href) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const linktext = href;
    const existing = this.findExistingLeaf(linktext);
    if (existing) {
      this.plugin.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }

    void this.plugin.app.workspace.openLinkText(linktext, "", "tab");
  }

  private findExistingLeaf(linktext: string) {
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linktext, "");
    if (!file) return null;
    let result: any = null;
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const v = leaf.view as unknown as { file?: TFile };
      if (v?.file?.path === file.path) result = leaf;
    });
    return result;
  }
}
