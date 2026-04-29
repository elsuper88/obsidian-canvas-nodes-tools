// Inject extra buttons in the canvas popup menu based on node type.
// Currently: only the "Quitar enlace" (unlink) button for text nodes with a cntLinks field.
// The description tag button is injected by description.ts directly.

import { setIcon, setTooltip } from "obsidian";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

const BTN_ID = "cnt-popup-unlink";

export class PopupMenuFeature {
  private attachedCanvases = new WeakSet<CanvasMin>();
  private observers = new WeakMap<CanvasMin, MutationObserver>();

  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    if (this.attachedCanvases.has(canvas)) return;
    this.attachedCanvases.add(canvas);

    const menuEl = canvas.menu?.menuEl;
    if (!menuEl) return;
    // Disconnect a previous observer if any (e.g. plugin reload).
    this.observers.get(canvas)?.disconnect();
    const obs = new MutationObserver(() => this.refresh(canvas, obs));
    obs.observe(menuEl, { childList: true });
    this.observers.set(canvas, obs);
    this.plugin.register(() => obs.disconnect());
    this.refresh(canvas, obs);
  }

  private refresh(canvas: CanvasMin, obs: MutationObserver): void {
    const menuEl = canvas.menu?.menuEl;
    if (!menuEl) return;
    if (menuEl.children.length === 0) return;

    const node = this.singleSelected(canvas);
    const shouldExist = !!(
      node &&
      node.getData().type === "text" &&
      Array.isArray(node.getData().cntLinks) &&
      (node.getData().cntLinks as string[]).length > 0
    );

    const existing = menuEl.querySelector(`#${BTN_ID}`) as HTMLElement | null;

    if (shouldExist && !existing) {
      // Pause observation while we add — avoid re-triggering ourselves.
      obs.disconnect();
      this.injectUnlinkButton(menuEl, canvas, node as CanvasNodeMin);
      obs.observe(menuEl, { childList: true });
    } else if (!shouldExist && existing) {
      obs.disconnect();
      existing.remove();
      obs.observe(menuEl, { childList: true });
    }
    // else: nothing to do — no DOM mutation, no extra observer firings
  }

  private injectUnlinkButton(
    menuEl: HTMLElement,
    canvas: CanvasMin,
    node: CanvasNodeMin,
  ): void {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.classList.add("clickable-icon");
    setIcon(btn, "unlink");
    setTooltip(btn, "Quitar enlace", { placement: "top" });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.plugin.linkedNotesFeature.removeLink(canvas, node);
      // After removal the next observer cycle will detect cntLinks empty
      // and remove the button automatically.
    });
    menuEl.appendChild(btn);
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
