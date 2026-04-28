// Modal for editing a node's description badge: text + color swatch.

import { App, Modal, setTooltip } from "obsidian";
import type { CntSettings } from "./settings";

export interface NodeDescription {
  text: string;
  color: string; // "1".."6" preset, or "#rrggbb"
}

export class DescriptionModal extends Modal {
  private desc: NodeDescription;
  private settings: CntSettings;
  private onSave: (next: NodeDescription | null) => void;

  private previewEl: HTMLElement | null = null;
  private swatchesEl: HTMLElement | null = null;
  private hexInputEl: HTMLInputElement | null = null;
  private hexRowEl: HTMLElement | null = null;

  constructor(
    app: App,
    current: NodeDescription | undefined,
    settings: CntSettings,
    onSave: (next: NodeDescription | null) => void,
  ) {
    super(app);
    this.desc = current
      ? { ...current }
      : { text: "", color: settings.defaultBadgeColor };
    this.settings = settings;
    this.onSave = onSave;
  }

  onOpen(): void {
    this.draw();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private draw(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cnd-modal");

    contentEl.createEl("h3", { text: "Node description" });

    // --- Live preview badge ---
    const previewWrap = contentEl.createDiv({ cls: "cnd-preview-wrap" });
    previewWrap.createEl("span", {
      text: "Preview",
      cls: "cnd-preview-label",
    });
    this.previewEl = previewWrap.createEl("span", {
      cls: "cnd-preview-badge",
    });
    this.updatePreview();

    // --- Text input ---
    const textRow = contentEl.createDiv({ cls: "cnd-row" });
    textRow.createEl("label", {
      text: "Text",
      cls: "cnd-row-label",
      attr: { for: "cnd-text-input" },
    });
    const textInput = textRow.createEl("input", {
      cls: "cnd-text-input",
      attr: {
        id: "cnd-text-input",
        type: "text",
        placeholder: "e.g. Cliente, Admin, Sistema",
        value: this.desc.text,
      },
    });
    textInput.addEventListener("input", () => {
      this.desc.text = textInput.value;
      this.updatePreview();
    });
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.commitSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    setTimeout(() => textInput.focus(), 50);

    // --- Color swatches ---
    const colorRow = contentEl.createDiv({ cls: "cnd-row" });
    colorRow.createEl("label", { text: "Color", cls: "cnd-row-label" });
    this.swatchesEl = colorRow.createDiv({ cls: "cnd-swatches" });

    const presets: { key: string; name: string }[] = [
      { key: "1", name: "Red" },
      { key: "2", name: "Orange" },
      { key: "3", name: "Yellow" },
      { key: "4", name: "Green" },
      { key: "5", name: "Cyan" },
      { key: "6", name: "Purple" },
    ];

    for (const p of presets) {
      const sw = this.swatchesEl.createEl("button", {
        cls: "cnd-swatch",
        attr: { type: "button", "data-color": p.key, "aria-label": p.name },
      });
      setTooltip(sw, p.name, { placement: "top" });
      sw.addEventListener("click", () => this.selectColor(p.key));
    }

    const customSwatch = this.swatchesEl.createEl("button", {
      cls: "cnd-swatch cnd-swatch-custom",
      attr: { type: "button", "data-color": "custom", "aria-label": "Custom hex" },
    });
    setTooltip(customSwatch, "Custom hex", { placement: "top" });
    customSwatch.createSpan({ text: "+" });
    customSwatch.addEventListener("click", () => {
      if (!this.desc.color.startsWith("#")) {
        this.desc.color = "#7f6df2";
      }
      this.refreshSwatchActive();
      this.refreshHexRow();
      this.updatePreview();
      this.hexInputEl?.focus();
    });

    // --- Hex input row (only visible when custom color is selected) ---
    this.hexRowEl = contentEl.createDiv({ cls: "cnd-row cnd-hex-row" });
    this.hexRowEl.createEl("label", { text: "Hex", cls: "cnd-row-label" });
    const hexWrap = this.hexRowEl.createDiv({ cls: "cnd-hex-wrap" });

    const colorPicker = hexWrap.createEl("input", {
      cls: "cnd-color-picker",
      attr: { type: "color" },
    });
    this.hexInputEl = hexWrap.createEl("input", {
      cls: "cnd-hex-input",
      attr: { type: "text", placeholder: "#7f6df2" },
    });

    const syncHexFromPicker = () => {
      this.desc.color = colorPicker.value;
      if (this.hexInputEl) this.hexInputEl.value = colorPicker.value;
      this.refreshSwatchActive();
      this.updatePreview();
    };
    const syncHexFromInput = () => {
      if (!this.hexInputEl) return;
      const v = this.hexInputEl.value.trim();
      this.desc.color = v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) colorPicker.value = v;
      this.refreshSwatchActive();
      this.updatePreview();
    };
    colorPicker.addEventListener("input", syncHexFromPicker);
    this.hexInputEl.addEventListener("input", syncHexFromInput);
    this.hexInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.commitSave();
      }
    });

    this.refreshSwatchActive();
    this.refreshHexRow();

    // --- Footer buttons ---
    const footer = contentEl.createDiv({ cls: "cnd-footer" });
    const removeBtn = footer.createEl("button", {
      cls: "mod-warning cnd-btn cnd-btn-remove",
      text: "Remove",
    });
    removeBtn.addEventListener("click", () => {
      this.onSave(null);
      this.close();
    });

    const cancelBtn = footer.createEl("button", {
      cls: "cnd-btn",
      text: "Cancel",
    });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", {
      cls: "mod-cta cnd-btn cnd-btn-save",
      text: "Save",
    });
    saveBtn.addEventListener("click", () => this.commitSave());
  }

  private selectColor(key: string): void {
    this.desc.color = key;
    this.refreshSwatchActive();
    this.refreshHexRow();
    this.updatePreview();
  }

  private commitSave(): void {
    if (!this.desc.text.trim()) {
      this.onSave(null);
    } else {
      this.onSave({
        text: this.desc.text.trim(),
        color: this.desc.color || this.settings.defaultBadgeColor,
      });
    }
    this.close();
  }

  private isCustomColor(): boolean {
    return this.desc.color.startsWith("#");
  }

  private refreshSwatchActive(): void {
    if (!this.swatchesEl) return;
    const activeKey = this.isCustomColor() ? "custom" : this.desc.color;
    this.swatchesEl.querySelectorAll(".cnd-swatch").forEach((el) => {
      const key = (el as HTMLElement).dataset.color;
      el.toggleClass("is-active", key === activeKey);
    });
    const customEl = this.swatchesEl.querySelector(
      ".cnd-swatch-custom",
    ) as HTMLElement | null;
    if (customEl && this.isCustomColor()) {
      customEl.style.setProperty("--cnd-swatch-color", this.desc.color);
    }
  }

  private refreshHexRow(): void {
    if (!this.hexRowEl || !this.hexInputEl) return;
    if (this.isCustomColor()) {
      this.hexRowEl.removeClass("is-hidden");
      this.hexInputEl.value = this.desc.color;
    } else {
      this.hexRowEl.addClass("is-hidden");
    }
  }

  private updatePreview(): void {
    if (!this.previewEl) return;
    const text = this.desc.text.trim() || "Preview";
    this.previewEl.textContent = text;
    this.previewEl.toggleClass("is-empty", !this.desc.text.trim());

    this.previewEl.removeAttribute("data-color");
    this.previewEl.style.removeProperty("--cnd-color");

    if (this.isCustomColor()) {
      this.previewEl.setAttribute("data-color", "custom");
      this.previewEl.style.setProperty("--cnd-color", this.desc.color);
    } else {
      this.previewEl.setAttribute("data-color", this.desc.color);
    }
  }
}
