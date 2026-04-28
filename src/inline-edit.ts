// Inline edit of a file node's node_title via contenteditable on dblclick of the body.

import { TFile, Notice } from "obsidian";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export class InlineEditFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    const flag = canvas as unknown as { _cntInlineAttached?: boolean };
    if (flag._cntInlineAttached) return;
    flag._cntInlineAttached = true;

    this.plugin.registerDomEvent(
      canvas.wrapperEl,
      "dblclick",
      (event) => this.onDblClick(canvas, event),
      { capture: true },
    );
  }

  private onDblClick(canvas: CanvasMin, event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Header link → handled by header-link feature, ignore here.
    if (target.closest(".markdown-embed-link, .canvas-node-label")) return;

    const nodeEl = target.closest(".canvas-node[data-cnt-title-mode='true']") as HTMLElement | null;
    if (!nodeEl) return;

    const node = this.findNodeByEl(canvas, nodeEl);
    if (!node) return;

    const file = this.fileForNode(node);
    if (!file) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.startEdit(node, file);
  }

  private startEdit(node: CanvasNodeMin, file: TFile): void {
    const inner = node.nodeEl.querySelector(".canvas-node-content") as HTMLElement | null;
    if (!inner) return;

    const original = inner.getAttribute("data-cnt-title-text") ?? "";
    inner.classList.add("cnt-editing");
    inner.removeAttribute("data-cnt-title-text"); // hide ::before during edit
    inner.contentEditable = "true";
    inner.textContent = original;

    const range = document.createRange();
    range.selectNodeContents(inner);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    inner.focus();

    let committed = false;

    const restore = (text: string) => {
      inner.contentEditable = "false";
      inner.classList.remove("cnt-editing");
      inner.textContent = "";
      inner.setAttribute("data-cnt-title-text", text);
    };

    const commit = async () => {
      if (committed) return;
      committed = true;
      const next = (inner.textContent ?? "").replace(/\n/g, " ").trim();
      try {
        await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
          if (next.length === 0) delete fm.node_title;
          else fm.node_title = next;
        });
      } catch (e) {
        new Notice("Couldn't save title: " + (e as Error).message);
        restore(original);
        return;
      }
      restore(next.length > 0 ? next : original);
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      restore(original);
    };

    inner.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        inner.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        inner.blur();
      }
    });

    inner.addEventListener("blur", () => void commit(), { once: true });
  }

  private findNodeByEl(canvas: CanvasMin, el: HTMLElement): CanvasNodeMin | null {
    for (const [, node] of canvas.nodes) {
      if (node.nodeEl === el) return node;
    }
    return null;
  }

  private fileForNode(node: CanvasNodeMin): TFile | null {
    const data = node.getData();
    if (data.type !== "file" || !data.file) return null;
    const f = this.plugin.app.vault.getAbstractFileByPath(data.file as string);
    return f instanceof TFile ? f : null;
  }
}
