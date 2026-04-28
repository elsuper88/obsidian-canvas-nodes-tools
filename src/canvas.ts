// Minimal types for Obsidian's internal canvas API.

import type { TFile } from "obsidian";

export interface CanvasNodeMin {
  id: string;
  nodeEl: HTMLElement;
  getData(): Record<string, unknown> & {
    type?: string;
    file?: string;
    text?: string;
    titleMode?: boolean;
    description?: { text: string; color: string };
  };
  setData(data: Record<string, unknown>): void;
  file?: TFile;
}

export interface CanvasMenuMin {
  menuEl: HTMLElement;
}

export interface CanvasMin {
  menu?: CanvasMenuMin;
  cardMenuEl?: HTMLElement;
  wrapperEl: HTMLElement;
  nodes: Map<string, CanvasNodeMin>;
  selection: Set<unknown>;
  view?: { file?: TFile };
  requestSave?: () => void;
}

export interface CanvasViewMin {
  canvas?: CanvasMin;
  file?: TFile;
}
