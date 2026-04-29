// Inject extra buttons in the canvas popup menu based on node type.
// Currently: only the "Quitar enlace" (unlink) button for text nodes with a cntLinks field.
// The description tag button is injected by description.ts directly.

import { setIcon, setTooltip } from "obsidian";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export class PopupMenuFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    const flag = canvas as unknown as { _cntPopupAttached?: boolean };
    if (flag._cntPopupAttached) return;
    flag._cntPopupAttached = true;

    const menuEl = canvas.menu?.menuEl;
    if (!menuEl) return;
    const obs = new MutationObserver(() => this.refresh(canvas));
    obs.observe(menuEl, { childList: true });
    this.plugin.register(() => obs.disconnect());
    this.refresh(canvas);
  }

  private refresh(canvas: CanvasMin): void {
    const menuEl = canvas.menu?.menuEl;
    if (!menuEl) return;
    if (menuEl.children.length === 0) return;

    const node = this.singleSelected(canvas);
    this.removeIfExists(menuEl, "cnt-popup-unlink");

    if (!node) return;
    const data = node.getData();

    if (
      data.type === "text" &&
      Array.isArray(data.cntLinks) &&
      (data.cntLinks as string[]).length > 0
    ) {
      this.injectUnlinkButton(menuEl, canvas, node);
    }
  }

  private injectUnlinkButton(
    menuEl: HTMLElement,
    canvas: CanvasMin,
    node: CanvasNodeMin,
  ): void {
    const btn = document.createElement("button");
    btn.id = "cnt-popup-unlink";
    btn.classList.add("clickable-icon");
    setIcon(btn, "unlink");
    setTooltip(btn, "Quitar enlace", { placement: "top" });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.plugin.linkedNotesFeature.removeLink(canvas, node);
      this.refresh(canvas);
    });
    menuEl.appendChild(btn);
  }

  private removeIfExists(menuEl: HTMLElement, id: string): void {
    const el = menuEl.querySelector(`#${id}`);
    if (el) el.remove();
  }

  private singleSelected(canvas: CanvasMin): CanvasNodeMin | null {
    if (!canvas.selection || canvas.selection.size !== 1) return null;
    for (const item of canvas.selection) {
      const cand = item as Partial<CanvasNodeMin> & { path?: unknown };
      if (cand.path !== undefined) return null;
      if (typeof cand.getData === "function") return cand as CanvasNodeMin;
    }
    return null;
  }
}
