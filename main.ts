// Plugin entry: lifecycle, settings, command registration. Feature modules attach to canvases.

import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  CntSettings,
  DEFAULT_SETTINGS,
  migrateFromOldPlugin,
  CntSettingsTab,
} from "./src/settings";
import { DescriptionFeature } from "./src/description";
import { TitleModeFeature } from "./src/title-mode";
import { InlineEditFeature } from "./src/inline-edit";
import { HeaderLinkFeature } from "./src/header-link";
import { PopupMenuFeature } from "./src/popup-menu";
import { ContextMenuFeature } from "./src/context-menu";
import { convertTextNodeToFile } from "./src/convert-text-to-file";
import type { CanvasViewMin, CanvasMin, CanvasNodeMin } from "./src/canvas";

export default class CanvasNodesToolsPlugin extends Plugin {
  settings: CntSettings = DEFAULT_SETTINGS;
  descriptionFeature!: DescriptionFeature;
  titleModeFeature!: TitleModeFeature;
  inlineEditFeature!: InlineEditFeature;
  headerLinkFeature!: HeaderLinkFeature;
  popupMenuFeature!: PopupMenuFeature;
  contextMenuFeature!: ContextMenuFeature;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.settings = await migrateFromOldPlugin(this.app, this.settings);
    await this.saveSettings();

    this.addSettingTab(new CntSettingsTab(this.app, this));

    this.descriptionFeature = new DescriptionFeature(this);
    this.titleModeFeature = new TitleModeFeature(this);
    this.headerLinkFeature = new HeaderLinkFeature(this);
    this.inlineEditFeature = new InlineEditFeature(this);
    this.popupMenuFeature = new PopupMenuFeature(this);
    this.contextMenuFeature = new ContextMenuFeature(this);
    this.contextMenuFeature.register();

    this.app.workspace.onLayoutReady(() => this.scanCanvases());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.scanCanvases()),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.scanCanvases()),
    );

    this.addCommand({
      id: "toggle-title-mode",
      name: "Toggle title-mode for selected file node",
      hotkeys: [{ modifiers: ["Mod"], key: "l" }],
      checkCallback: (checking) => {
        const canvas = this.getActiveCanvas();
        if (!canvas) return false;
        const node = this.getSingleSelectedNode(canvas);
        if (!node) return false;
        const data = node.getData();
        if (data.type !== "file") return false;
        if (checking) return true;

        const isCurrentlyOff = data.titleMode === false;
        const newData = { ...data };
        if (isCurrentlyOff) {
          delete newData.titleMode;
        } else {
          newData.titleMode = false;
        }
        node.setData(newData);
        void this.titleModeFeature.applyToNode(node);
        canvas.requestSave?.();
        return true;
      },
    });

    this.addCommand({
      id: "convert-text-to-file",
      name: "Convert text node to .md file",
      hotkeys: [{ modifiers: ["Mod"], key: "k" }],
      checkCallback: (checking) => {
        const canvas = this.getActiveCanvas();
        if (!canvas) return false;
        const node = this.getSingleSelectedNode(canvas);
        if (!node) return false;
        if (node.getData().type !== "text") return false;
        if (checking) return true;
        void convertTextNodeToFile(this, canvas, node);
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
    for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
      if (leaf === this.app.workspace.activeLeaf) {
        const view = leaf.view as unknown as CanvasViewMin;
        return view.canvas ?? null;
      }
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
    this.titleModeFeature.attachToCanvas(canvas);
    // Order is load-bearing: headerLinkFeature MUST attach before inlineEditFeature
    // because both register capture-phase dblclick listeners on wrapperEl and
    // headerLinkFeature must intercept header clicks before inlineEditFeature does.
    this.headerLinkFeature.attachToCanvas(canvas);
    this.inlineEditFeature.attachToCanvas(canvas);
    this.popupMenuFeature.attachToCanvas(canvas);
  }
}
