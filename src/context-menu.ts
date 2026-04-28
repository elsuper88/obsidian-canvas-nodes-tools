// Native context-menu integration for canvas nodes (right-click menu).

import type { Menu } from "obsidian";
import { convertTextNodeToFile } from "./convert-text-to-file";
import type { CanvasMin, CanvasNodeMin, CanvasViewMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

interface CanvasNodeMenuEvent {
  menu: Menu;
  node: CanvasNodeMin;
}

export class ContextMenuFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  register(): void {
    const ws = this.plugin.app.workspace as unknown as {
      on(name: string, cb: (menu: Menu, node: CanvasNodeMin) => void): unknown;
    };
    this.plugin.registerEvent(
      ws.on("canvas:node-menu", (menu: Menu, node: CanvasNodeMin) =>
        this.onNodeMenu(menu, node),
      ) as never,
    );
  }

  private onNodeMenu(menu: Menu, node: CanvasNodeMin): void {
    const data = node.getData();

    if (data.type === "file") {
      const isOn = data.titleMode !== false;
      menu.addItem((item) => {
        item
          .setTitle(isOn ? "Ver contenido completo" : "Ver solo título")
          .setIcon(isOn ? "text-cursor-input" : "book-open")
          .onClick(() => {
            const newData = { ...node.getData() };
            if (newData.titleMode === false) delete newData.titleMode;
            else newData.titleMode = false;
            node.setData(newData);
            void this.plugin.titleModeFeature.applyToNode(node);
            const canvas = this.getActiveCanvas();
            canvas?.requestSave?.();
          });
      });
    } else if (data.type === "text") {
      menu.addItem((item) => {
        item
          .setTitle("Convertir a nota .md")
          .setIcon("file-plus")
          .onClick(() => {
            const canvas = this.getActiveCanvas();
            if (canvas) void convertTextNodeToFile(this.plugin, canvas, node);
          });
      });
    }
  }

  private getActiveCanvas(): CanvasMin | null {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("canvas")) {
      if (leaf === this.plugin.app.workspace.activeLeaf) {
        const view = leaf.view as unknown as CanvasViewMin;
        return view.canvas ?? null;
      }
    }
    return null;
  }
}
