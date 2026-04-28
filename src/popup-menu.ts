// Inject extra buttons in the canvas popup menu based on node type.

import { setIcon, setTooltip } from "obsidian";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";
import { convertTextNodeToFile } from "./convert-text-to-file";

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
    this.removeIfExists(menuEl, "cnt-popup-title-toggle");
    this.removeIfExists(menuEl, "cnt-popup-text-to-file");

    if (!node) return;
    const data = node.getData();

    if (data.type === "file") {
      this.injectTitleToggle(menuEl, canvas, node);
    } else if (data.type === "text") {
      this.injectTextToFile(menuEl, canvas, node);
    }
  }

  private injectTitleToggle(
    menuEl: HTMLElement,
    canvas: CanvasMin,
    node: CanvasNodeMin,
  ): void {
    const data = node.getData();
    const isOn = data.titleMode !== false;
    const btn = document.createElement("button");
    btn.id = "cnt-popup-title-toggle";
    btn.classList.add("clickable-icon");
    setIcon(btn, isOn ? "text-cursor-input" : "book-open");
    setTooltip(btn, isOn ? "Ver contenido completo" : "Ver solo título", {
      placement: "top",
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newData = { ...node.getData() };
      if (newData.titleMode === false) {
        delete newData.titleMode;
      } else {
        newData.titleMode = false;
      }
      node.setData(newData);
      void this.plugin.titleModeFeature.applyToNode(node);
      canvas.requestSave?.();
      this.refresh(canvas);
    });
    menuEl.appendChild(btn);
  }

  private injectTextToFile(
    menuEl: HTMLElement,
    canvas: CanvasMin,
    node: CanvasNodeMin,
  ): void {
    const btn = document.createElement("button");
    btn.id = "cnt-popup-text-to-file";
    btn.classList.add("clickable-icon");
    setIcon(btn, "file-plus");
    setTooltip(btn, "Convertir a nota .md", { placement: "top" });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void convertTextNodeToFile(this.plugin, canvas, node);
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
