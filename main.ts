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
    // CRITICAL: addCommand must run synchronously inside onload — BEFORE any
    // await — so Obsidian's hotkey registry picks up the default binding.
    // If we register after an await (which yields the event loop), the
    // default hotkey is silently dropped and Cmd+K never fires until the
    // user assigns it manually in Settings → Hotkeys.
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

    // Now async setup.
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

    // Force a rebake — covers the case where the plugin is enabled
    // mid-session and Obsidian's keymap is already cached from boot.
    const hm = (this.app as unknown as { hotkeyManager?: { bake: () => void } }).hotkeyManager;
    hm?.bake?.();
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

    const active = this.app.workspace.activeLeaf;

    // 1. activeLeaf is a canvas AND has a selection — strongest match.
    if (active && canvasLeaves.includes(active)) {
      const v = active.view as unknown as CanvasViewMin;
      if (v.canvas && (v.canvas.selection?.size ?? 0) > 0) return v.canvas;
    }

    // 2. Any open canvas with a selection (user picked a node before
    //    focus moved to another panel, or to another canvas leaf).
    for (const leaf of canvasLeaves) {
      const c = (leaf.view as unknown as CanvasViewMin).canvas;
      if (c && (c.selection?.size ?? 0) > 0) return c;
    }

    // 3. No selection: prefer the active leaf if it is a canvas.
    if (active && canvasLeaves.includes(active)) {
      const v = active.view as unknown as CanvasViewMin;
      if (v.canvas) return v.canvas;
    }

    // 4. Single canvas open and we got here: use it.
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
