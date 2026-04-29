// Description badge feature: renders a labeled badge above each canvas node
// and provides a global eye-toggle button plus a per-node edit modal.

import { setIcon, setTooltip } from "obsidian";
import type CanvasNodesToolsPlugin from "../main";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import { DescriptionModal } from "./modal-description";

export class DescriptionFeature {
  private plugin: CanvasNodesToolsPlugin;
  private attachedCanvases = new WeakSet<CanvasMin>();
  private menuObservers = new WeakMap<HTMLElement, MutationObserver>();

  constructor(plugin: CanvasNodesToolsPlugin) {
    this.plugin = plugin;
  }

  // -----------------------------------------------------------------------
  // Public API called from main.ts
  // -----------------------------------------------------------------------

  attachToCanvas(canvas: CanvasMin): void {
    if (this.attachedCanvases.has(canvas)) {
      // Already attached — nothing to do. Existing observers handle node updates.
      return;
    }
    this.attachedCanvases.add(canvas);

    if (this.plugin.settings.badgeHiddenByDefault) {
      canvas.wrapperEl.classList.add("cnd-hidden");
    }

    this.applyPositionClass(canvas);
    this.injectCardMenuToggle(canvas);
    this.observePopupMenu(canvas);
    this.applyAll(canvas);
  }

  applyAll(canvas: CanvasMin): void {
    for (const [, node] of canvas.nodes) {
      this.applyToNode(node);
    }
  }

  applyToNode(node: CanvasNodeMin): void {
    const desc = node.getData().description;
    const el = node.nodeEl;

    if (!desc || !desc.text) {
      el.removeAttribute("data-cnd-text");
      el.removeAttribute("data-cnd-color");
      el.style.removeProperty("--cnd-color");
      return;
    }

    el.setAttribute("data-cnd-text", desc.text);

    if (desc.color && desc.color.startsWith("#")) {
      el.style.setProperty("--cnd-color", desc.color);
      el.setAttribute("data-cnd-color", "custom");
    } else if (desc.color) {
      el.setAttribute("data-cnd-color", desc.color);
      el.style.removeProperty("--cnd-color");
    } else {
      el.removeAttribute("data-cnd-color");
      el.style.removeProperty("--cnd-color");
    }
  }

  openModal(canvas: CanvasMin, node: CanvasNodeMin): void {
    if (!node || typeof node.getData !== "function") return;
    const current = node.getData().description;
    const modal = new DescriptionModal(
      this.plugin.app,
      current,
      this.plugin.settings,
      (next) => {
        const data = { ...node.getData() };
        if (next === null) {
          delete data.description;
        } else {
          data.description = next;
        }
        node.setData(data);
        this.applyToNode(node);
        canvas.requestSave?.();
      },
    );
    modal.open();
  }

  // -----------------------------------------------------------------------
  // Position class
  // -----------------------------------------------------------------------

  private applyPositionClass(canvas: CanvasMin): void {
    const w = canvas.wrapperEl;
    w.classList.remove(
      "cnd-pos-top-right",
      "cnd-pos-top-left",
      "cnd-pos-top-center",
    );
    w.classList.add(`cnd-pos-${this.plugin.settings.badgePosition}`);
  }

  // -----------------------------------------------------------------------
  // Card menu (right-side toolbar) — global eye toggle
  // -----------------------------------------------------------------------

  private injectCardMenuToggle(canvas: CanvasMin): void {
    const cardMenu = canvas.cardMenuEl;
    if (!cardMenu) return;

    const id = "cnt-toggle-card";
    cardMenu.querySelector(`#${id}`)?.remove();

    const btn = document.createElement("div");
    btn.id = id;
    btn.classList.add("canvas-card-menu-button", "mod-draggable");

    const updateIcon = () => {
      const hidden = canvas.wrapperEl.classList.contains("cnd-hidden");
      setIcon(btn, hidden ? "eye-off" : "eye");
      setTooltip(
        btn,
        hidden ? "Show node descriptions" : "Hide node descriptions",
        { placement: "left" },
      );
    };
    updateIcon();

    btn.addEventListener("click", () => {
      canvas.wrapperEl.classList.toggle("cnd-hidden");
      updateIcon();
    });

    cardMenu.appendChild(btn);
  }

  // -----------------------------------------------------------------------
  // Popup menu (selected-node toolbar) — per-node description button
  // -----------------------------------------------------------------------

  private observePopupMenu(canvas: CanvasMin): void {
    const menuEl = canvas.menu?.menuEl;
    if (!menuEl) return;
    if (this.menuObservers.has(menuEl)) return;

    const obs = new MutationObserver(() => this.injectPopupButton(canvas, obs));
    obs.observe(menuEl, { childList: true });
    this.menuObservers.set(menuEl, obs);
    this.plugin.register(() => obs.disconnect());

    this.injectPopupButton(canvas, obs);
  }

  private injectPopupButton(canvas: CanvasMin, obs?: MutationObserver): void {
    const menuEl = canvas.menu?.menuEl;
    if (!menuEl) return;
    if (menuEl.querySelector("#cnt-popup-description-btn")) return;
    if (menuEl.children.length === 0) return;

    const btn = document.createElement("button");
    btn.id = "cnt-popup-description-btn";
    btn.classList.add("clickable-icon");
    setIcon(btn, "tag");
    setTooltip(btn, "Add or edit description", { placement: "top" });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const node = this.firstSelectedNode(canvas);
      if (!node) return;
      this.openModal(canvas, node);
    });

    // Pause observation while we mutate so we don't re-trigger ourselves.
    if (obs) obs.disconnect();
    menuEl.appendChild(btn);
    if (obs) obs.observe(menuEl, { childList: true });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private firstSelectedNode(canvas: CanvasMin): CanvasNodeMin | null {
    const sel = canvas.selection;
    if (!sel || typeof (sel as Set<unknown>).size !== "number") return null;
    for (const item of sel as Set<unknown>) {
      const candidate = item as Partial<CanvasNodeMin> & { path?: unknown };
      // Edges have a .path property in Obsidian's canvas; nodes don't.
      if (candidate?.path !== undefined) continue;
      if (typeof candidate?.getData === "function") {
        return candidate as CanvasNodeMin;
      }
    }
    return null;
  }
}
