// Plugin entry: lifecycle, settings, command registration. Feature modules attach to canvases.

import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  CntSettings,
  DEFAULT_SETTINGS,
  migrateFromOldPlugin,
  CntSettingsTab,
} from "./src/settings";
import { DescriptionFeature } from "./src/description";
import { LinkedNotesFeature } from "./src/linked-notes";
import { PopupMenuFeature } from "./src/popup-menu";
import type { CanvasViewMin, CanvasMin, CanvasNodeMin } from "./src/canvas";

export default class CanvasNodesToolsPlugin extends Plugin {
  settings: CntSettings = DEFAULT_SETTINGS;
  descriptionFeature!: DescriptionFeature;
  linkedNotesFeature!: LinkedNotesFeature;
  popupMenuFeature!: PopupMenuFeature;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.settings = await migrateFromOldPlugin(this.app, this.settings);
    await this.saveSettings();

    this.addSettingTab(new CntSettingsTab(this.app, this));

    this.descriptionFeature = new DescriptionFeature(this);
    this.linkedNotesFeature = new LinkedNotesFeature(this);
    this.popupMenuFeature = new PopupMenuFeature(this);

    this.app.workspace.onLayoutReady(() => this.scanCanvases());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.scanCanvases()),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.scanCanvases()),
    );

    this.addCommand({
      id: "link-note",
      name: "Enlazar nota al text node seleccionado",
      hotkeys: [{ modifiers: ["Mod"], key: "k" }],
      checkCallback: (checking) => {
        const canvas = this.getActiveCanvas();
        if (!canvas) return false;
        const node = this.getSingleSelectedNode(canvas);
        if (!node) return false;
        if (node.getData().type !== "text") return false;
        if (checking) return true;
        this.linkedNotesFeature.openSwitcher(canvas, node);
        return true;
      },
    });
  }

  onunload(): void {
    // Feature modules clean up via this.register*.
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getActiveCanvas(): CanvasMin | null {
    const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");
    if (canvasLeaves.length === 0) return null;

    // 1. Prefer the leaf currently focused.
    const active = this.app.workspace.activeLeaf;
    if (active && canvasLeaves.includes(active)) {
      const v = active.view as unknown as CanvasViewMin;
      if (v.canvas) return v.canvas;
    }

    // 2. Fallback: a canvas with an active selection (user clicked a node
    //    even if focus moved to another panel like Properties).
    for (const leaf of canvasLeaves) {
      const v = leaf.view as unknown as CanvasViewMin;
      const c = v.canvas;
      if (c && c.selection && c.selection.size > 0) return c;
    }

    // 3. Single canvas open: use it unconditionally.
    if (canvasLeaves.length === 1) {
      const v = canvasLeaves[0].view as unknown as CanvasViewMin;
      return v.canvas ?? null;
    }

    return null;
  }

  private getSingleSelectedNode(canvas: CanvasMin): CanvasNodeMin | null {
    if (!canvas.selection || canvas.selection.size !== 1) return null;
    for (const item of canvas.selection) {
      const cand = item as Partial<CanvasNodeMin> & { path?: unknown };
      if (cand.path !== undefined) return null;
      if (typeof cand.getData === "function") return cand as CanvasNodeMin;
    }
    return null;
  }

  private scanCanvases(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
      this.attachLeaf(leaf);
    }
  }

  private attachLeaf(leaf: WorkspaceLeaf): void {
    const view = leaf.view as unknown as CanvasViewMin;
    const canvas = view.canvas;
    if (!canvas) return;
    this.descriptionFeature.attachToCanvas(canvas);
    this.linkedNotesFeature.attachToCanvas(canvas);
    this.popupMenuFeature.attachToCanvas(canvas);
  }
}
