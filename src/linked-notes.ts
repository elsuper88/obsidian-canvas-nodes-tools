// Linked notes feature: per-text-node single outbound wikilink rendered as a small pill.

import { TFile, FuzzySuggestModal, Notice } from "obsidian";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

const PILL_CLASS = "cnt-link-pill";
const ATTR_HIDE = "data-cnt-link-hidden";

export class LinkedNotesFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    const flag = canvas as unknown as { _cntLinkedAttached?: boolean };
    if (flag._cntLinkedAttached) {
      this.applyAll(canvas);
      return;
    }
    flag._cntLinkedAttached = true;
    this.applyAll(canvas);

    // Re-render pills only when a vault file is renamed (the displayed
    // basename can change). We don't subscribe to metadataCache.changed
    // because that fires for every edit and would cause unnecessary work.
    this.plugin.registerEvent(
      this.plugin.app.vault.on("rename", () => this.applyAll(canvas)),
    );
  }

  applyAll(canvas: CanvasMin): void {
    for (const [, node] of canvas.nodes) {
      this.applyToNode(node);
    }
  }

  applyToNode(node: CanvasNodeMin): void {
    const data = node.getData() as Record<string, unknown> & {
      type?: string;
      cntLinks?: unknown;
    };
    const el = node.nodeEl;
    const existing = el.querySelector(`:scope > .${PILL_CLASS}`) as HTMLElement | null;

    const links = Array.isArray(data.cntLinks) ? (data.cntLinks as string[]) : [];
    const linkName = links[0];

    if (data.type !== "text" || !linkName) {
      el.removeAttribute(ATTR_HIDE);
      existing?.remove();
      return;
    }

    el.setAttribute(ATTR_HIDE, "true");
    el.setAttribute("data-cnt-link-pos", this.plugin.settings.linkedPillPosition || "top-right");

    const pill = existing ?? this.createPill(el);
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkName, "");
    pill.textContent = file?.basename ?? linkName;
    pill.classList.toggle("is-unresolved", !file);
    pill.dataset.linkName = linkName;
  }

  private createPill(parent: HTMLElement): HTMLElement {
    const pill = document.createElement("div");
    pill.className = PILL_CLASS;

    pill.addEventListener("click", (e) => {
      // Plain click: do nothing (let the user select the node only).
      e.preventDefault();
      e.stopPropagation();
    });

    pill.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = pill.dataset.linkName;
      if (!name) return;
      void this.plugin.app.workspace.openLinkText(name, "", "tab");
    });

    parent.appendChild(pill);
    return pill;
  }

  // Public: called by the Cmd+K command.
  openSwitcher(canvas: CanvasMin, node: CanvasNodeMin): void {
    if (node.getData().type !== "text") {
      new Notice("Solo se pueden enlazar text nodes");
      return;
    }
    const app = this.plugin.app;
    const self = this;

    class FilePickerModal extends FuzzySuggestModal<TFile> {
      constructor() {
        super(app);
        this.setPlaceholder("Buscar nota para enlazar...");
      }
      getItems(): TFile[] {
        return app.vault.getMarkdownFiles();
      }
      getItemText(item: TFile): string {
        return item.path;
      }
      onChooseItem(item: TFile): void {
        void self.setLink(canvas, node, item);
      }
    }
    new FilePickerModal().open();
  }

  async setLink(canvas: CanvasMin, node: CanvasNodeMin, file: TFile): Promise<void> {
    const linkName = file.basename;
    const data = { ...(node.getData() as Record<string, unknown>) };
    const prevLinks = Array.isArray(data.cntLinks) ? (data.cntLinks as string[]) : [];
    const prevText = (data.text as string | undefined) ?? "";

    // Remove any previous appended links from text and add the new one.
    const cleaned = this.stripAppendedLinks(prevText, prevLinks);
    const newText = cleaned.replace(/\s+$/, "") + `\n\n[[${linkName}]]`;

    data.text = newText;
    data.cntLinks = [linkName];
    node.setData(data);
    this.applyToNode(node);
    canvas.requestSave?.();
  }

  async removeLink(canvas: CanvasMin, node: CanvasNodeMin): Promise<void> {
    const data = { ...(node.getData() as Record<string, unknown>) };
    const prevLinks = Array.isArray(data.cntLinks) ? (data.cntLinks as string[]) : [];
    const prevText = (data.text as string | undefined) ?? "";
    if (prevLinks.length === 0) return;

    const cleaned = this.stripAppendedLinks(prevText, prevLinks).replace(/\s+$/, "");
    data.text = cleaned;
    delete data.cntLinks;
    node.setData(data);
    this.applyToNode(node);
    canvas.requestSave?.();
  }

  private stripAppendedLinks(text: string, links: string[]): string {
    let out = text;
    for (const name of links) {
      // Remove a trailing block of optional whitespace, then [[name]] at the end.
      const re = new RegExp(`\\s*\\[\\[${this.escapeRegex(name)}\\]\\]\\s*$`);
      out = out.replace(re, "");
    }
    return out;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
