// Settings + tab + one-time migration from canvas-node-description's data.json.

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type CanvasNodesToolsPlugin from "../main";

export interface CntSettings {
  defaultBadgeColor: string;
  badgePosition: "top-right" | "top-left" | "top-center";
  badgeHiddenByDefault: boolean;
  migrationNoticeShown: boolean;
  linkedPillPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export const DEFAULT_SETTINGS: CntSettings = {
  defaultBadgeColor: "4",
  badgePosition: "top-right",
  badgeHiddenByDefault: false,
  migrationNoticeShown: false,
  linkedPillPosition: "top-right",
};

export async function migrateFromOldPlugin(
  app: App,
  current: CntSettings,
): Promise<CntSettings> {
  if (current.migrationNoticeShown) return current;

  const oldPath = ".obsidian/plugins/canvas-node-description/data.json";
  let oldData: Record<string, unknown> | null = null;
  try {
    if (await app.vault.adapter.exists(oldPath)) {
      const raw = await app.vault.adapter.read(oldPath);
      oldData = JSON.parse(raw) as Record<string, unknown>;
    }
  } catch {
    oldData = null;
  }

  const merged: CntSettings = { ...current };
  if (oldData) {
    if (typeof oldData.defaultColor === "string") merged.defaultBadgeColor = oldData.defaultColor;
    if (typeof oldData.position === "string") merged.badgePosition = oldData.position as CntSettings["badgePosition"];
    if (typeof oldData.hiddenByDefault === "boolean") merged.badgeHiddenByDefault = oldData.hiddenByDefault;

    new Notice(
      "Canvas Node Description was replaced by Canvas Nodes Tools. You can now uninstall the old plugin from Settings.",
      8000,
    );
  }
  merged.migrationNoticeShown = true;
  return merged;
}

export class CntSettingsTab extends PluginSettingTab {
  plugin: CanvasNodesToolsPlugin;

  constructor(app: App, plugin: CanvasNodesToolsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "Description badge" });

    new Setting(containerEl)
      .setName("Default badge color")
      .addDropdown((d) =>
        d
          .addOption("1", "Red")
          .addOption("2", "Orange")
          .addOption("3", "Yellow")
          .addOption("4", "Green")
          .addOption("5", "Cyan")
          .addOption("6", "Purple")
          .setValue(this.plugin.settings.defaultBadgeColor)
          .onChange(async (v) => {
            this.plugin.settings.defaultBadgeColor = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Badge position")
      .addDropdown((d) =>
        d
          .addOption("top-right", "Top right")
          .addOption("top-left", "Top left")
          .addOption("top-center", "Top center")
          .setValue(this.plugin.settings.badgePosition)
          .onChange(async (v) => {
            this.plugin.settings.badgePosition = v as CntSettings["badgePosition"];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Hide all badges by default")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.badgeHiddenByDefault)
          .onChange(async (v) => {
            this.plugin.settings.badgeHiddenByDefault = v;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Linked notes" });

    new Setting(containerEl)
      .setName("Posición del enlace saliente")
      .setDesc("Posición de la pastilla de enlace dentro del nodo de texto.")
      .addDropdown((d) =>
        d
          .addOption("top-right", "Top right")
          .addOption("top-left", "Top left")
          .addOption("bottom-right", "Bottom right")
          .addOption("bottom-left", "Bottom left")
          .setValue(this.plugin.settings.linkedPillPosition)
          .onChange(async (v) => {
            this.plugin.settings.linkedPillPosition = v as CntSettings["linkedPillPosition"];
            await this.plugin.saveSettings();
          }),
      );
  }
}
