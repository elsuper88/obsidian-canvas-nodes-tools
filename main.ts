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
import type { CanvasViewMin } from "./src/canvas";

export default class CanvasNodesToolsPlugin extends Plugin {
  settings: CntSettings = DEFAULT_SETTINGS;
  descriptionFeature!: DescriptionFeature;
  titleModeFeature!: TitleModeFeature;
  inlineEditFeature!: InlineEditFeature;
  headerLinkFeature!: HeaderLinkFeature;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.settings = await migrateFromOldPlugin(this.app, this.settings);
    await this.saveSettings();

    this.addSettingTab(new CntSettingsTab(this.app, this));

    this.descriptionFeature = new DescriptionFeature(this);
    this.titleModeFeature = new TitleModeFeature(this);
    this.headerLinkFeature = new HeaderLinkFeature(this);
    this.inlineEditFeature = new InlineEditFeature(this);

    this.app.workspace.onLayoutReady(() => this.scanCanvases());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.scanCanvases()),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.scanCanvases()),
    );
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
    this.headerLinkFeature.attachToCanvas(canvas);
    this.inlineEditFeature.attachToCanvas(canvas);
  }
}
