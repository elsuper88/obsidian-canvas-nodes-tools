# Canvas Nodes Tools Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Obsidian plugin `obsidian-canvas-nodes-tools` that replaces `canvas-node-description`, adding a title-mode for file nodes (with inline editing), a header→new-tab interceptor, a `Cmd+K` text-to-file converter, and migration from the old plugin.

**Architecture:** Modular TypeScript plugin compiled with esbuild. The `main.ts` entry registers commands and lifecycle hooks; small `src/` modules each own one feature (description, title-mode, inline-edit, header-link, convert, settings). Shared canvas types live in `src/canvas.ts`. Pure logic (filename slug, title resolver, frontmatter helpers) is unit-tested with vitest. DOM-bound behaviors are validated through a manual smoke checklist that the implementer runs before tagging a release.

**Tech Stack:** TypeScript, esbuild, vitest (unit tests for pure logic), Obsidian Plugin API 1.5+. No runtime dependencies beyond `obsidian`.

**Spec reference:** `docs/superpowers/specs/2026-04-28-canvas-nodes-tools-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `manifest.json` | Plugin manifest. ID `obsidian-canvas-nodes-tools`. |
| `package.json` | Build scripts, devDeps (`obsidian`, `esbuild`, `vitest`, `typescript`). |
| `tsconfig.json` | Strict TypeScript config. |
| `esbuild.config.mjs` | Bundle TS to `main.js`. |
| `vitest.config.ts` | Test config with `node` env, `tests/**` glob. |
| `.gitignore` | `node_modules`, `main.js`, `data.json`, `coverage/`, `.DS_Store`. |
| `LICENSE` | MIT, author Raulyn Polanco. |
| `README.md` | Install, usage, shortcuts, migration notes. |
| `main.ts` | Plugin entry. Loads settings, attaches to canvases, registers commands. |
| `styles.css` | Description badge + title-mode + inline-edit styling. |
| `src/canvas.ts` | Shared `CanvasMin`, `CanvasNodeMin`, `CanvasMenuMin` types. |
| `src/title.ts` | Pure functions: `stripFrontmatter`, `firstNonEmptyLine`, `resolveTitleFromCache` (no I/O), `sanitizeFilename`. Unit-tested. |
| `src/title-mode.ts` | Per-canvas attach: scan nodes, set `data-cnt-title-mode`, render the title text node, react to `metadataCache.changed`. |
| `src/inline-edit.ts` | `dblclick` capture handler, contenteditable lifecycle, persist via `processFrontMatter`. |
| `src/header-link.ts` | Intercepts dblclick on embed header → opens note in new tab. |
| `src/convert-text-to-file.ts` | `Cmd+K` command implementation. |
| `src/description.ts` | Description badge feature ported from old plugin. |
| `src/modal-description.ts` | Description modal ported from old plugin. |
| `src/settings.ts` | `CntSettings` interface, defaults, settings tab, migration from old plugin's `data.json`. |
| `tests/title.test.ts` | Vitest unit tests for `src/title.ts`. |
| `tests/sanitize.test.ts` | Vitest unit tests for `sanitizeFilename` and `uniqueFilename` candidate generation. |

The split keeps each file under ~250 lines. Description and title-mode never share state — they're orthogonal features that happen to install handlers on the same canvas.

---

## Conventions

- All files have the file name and brief responsibility as a one-line comment at top, no other comments unless WHY is non-obvious (per project guidelines).
- Strings shown to users are in **English** (Spanish localization is out of scope per spec).
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).
- Each task ends with a commit. Don't batch unrelated changes.

---

## Task 1: Scaffold the project

**Files:**
- Create: `~/obsidian-canvas-nodes-tools/manifest.json`
- Create: `~/obsidian-canvas-nodes-tools/package.json`
- Create: `~/obsidian-canvas-nodes-tools/tsconfig.json`
- Create: `~/obsidian-canvas-nodes-tools/esbuild.config.mjs`
- Create: `~/obsidian-canvas-nodes-tools/vitest.config.ts`
- Create: `~/obsidian-canvas-nodes-tools/LICENSE`

- [ ] **Step 1: `manifest.json`**

```json
{
  "id": "obsidian-canvas-nodes-tools",
  "name": "Canvas Nodes Tools",
  "version": "1.0.0",
  "minAppVersion": "1.5.0",
  "description": "Title-mode for canvas file nodes with inline editing, description badges, and a one-shot text-to-file conversion. Replaces canvas-node-description.",
  "author": "Raulyn Polanco",
  "authorUrl": "https://github.com/elsuper88",
  "isDesktopOnly": false
}
```

- [ ] **Step 2: `package.json`**

```json
{
  "name": "obsidian-canvas-nodes-tools",
  "version": "1.0.0",
  "description": "Obsidian plugin: canvas node title-mode, inline editing, descriptions, text-to-file conversion.",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["obsidian", "plugin", "canvas"],
  "author": "Raulyn Polanco",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.10.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.20.0",
    "obsidian": "^1.5.0",
    "tslib": "^2.6.2",
    "typescript": "^5.3.3",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2020",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES2020"]
  },
  "include": ["main.ts", "src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 4: `esbuild.config.mjs`**

```js
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

if (prod) { await ctx.rebuild(); process.exit(0); }
else { await ctx.watch(); }
```

- [ ] **Step 5: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: `LICENSE`** — MIT, copyright `2026 Raulyn Polanco`.

- [ ] **Step 7: Install deps and verify build pipeline**

Run: `cd ~/obsidian-canvas-nodes-tools && npm install`
Expected: dependencies installed without errors.

Run: `npm run test -- --run`
Expected: vitest exits with `No test files found` (no error — there are none yet).

- [ ] **Step 8: Commit**

```bash
git add manifest.json package.json tsconfig.json esbuild.config.mjs vitest.config.ts LICENSE package-lock.json
git commit -m "chore: scaffold plugin with esbuild and vitest"
```

---

## Task 2: Pure title resolver (TDD)

**Files:**
- Create: `src/title.ts`
- Create: `tests/title.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/title.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  stripFrontmatter,
  firstNonEmptyLine,
  resolveTitle,
} from "../src/title";

describe("stripFrontmatter", () => {
  it("removes leading frontmatter", () => {
    const input = `---\nfoo: bar\n---\n\n# Title\nbody`;
    expect(stripFrontmatter(input)).toBe(`# Title\nbody`);
  });

  it("returns input unchanged when no frontmatter", () => {
    expect(stripFrontmatter(`# Just text`)).toBe(`# Just text`);
  });

  it("handles empty frontmatter", () => {
    expect(stripFrontmatter(`---\n---\nbody`)).toBe(`body`);
  });
});

describe("firstNonEmptyLine", () => {
  it("returns first non-blank trimmed line", () => {
    expect(firstNonEmptyLine(`\n  \n  hello \nworld`)).toBe("hello");
  });

  it("strips leading heading hashes", () => {
    expect(firstNonEmptyLine(`# My title\nbody`)).toBe("My title");
    expect(firstNonEmptyLine(`### Sub\nbody`)).toBe("Sub");
  });

  it("returns null when text is all whitespace", () => {
    expect(firstNonEmptyLine(`   \n\n  `)).toBe(null);
  });
});

describe("resolveTitle", () => {
  it("uses node_title from frontmatter when present", () => {
    const r = resolveTitle({
      basename: "fallback",
      frontmatter: { node_title: "From FM" },
      body: "# Heading\ntext",
    });
    expect(r).toBe("From FM");
  });

  it("falls back to first body line when no node_title", () => {
    const r = resolveTitle({
      basename: "fallback",
      frontmatter: {},
      body: "# My heading\ntext",
    });
    expect(r).toBe("My heading");
  });

  it("falls back to basename when body is empty", () => {
    const r = resolveTitle({
      basename: "Fallback",
      frontmatter: {},
      body: "",
    });
    expect(r).toBe("Fallback");
  });

  it("coerces non-string node_title to string", () => {
    const r = resolveTitle({
      basename: "fallback",
      frontmatter: { node_title: 42 },
      body: "x",
    });
    expect(r).toBe("42");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/title'`.

- [ ] **Step 3: Implement `src/title.ts`**

```ts
// Pure title resolution: strip frontmatter, pick first line, or use frontmatter node_title.

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n/, "");
}

export function firstNonEmptyLine(body: string): string | null {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    return line.replace(/^#+\s*/, "");
  }
  return null;
}

export interface ResolveTitleInput {
  basename: string;
  frontmatter: Record<string, unknown>;
  body: string; // already stripped of frontmatter
}

export function resolveTitle(input: ResolveTitleInput): string {
  const fm = input.frontmatter?.node_title;
  if (fm !== undefined && fm !== null && String(fm).trim().length > 0) {
    return String(fm);
  }
  const first = firstNonEmptyLine(input.body);
  if (first) return first;
  return input.basename;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/title.ts tests/title.test.ts
git commit -m "feat(title): pure title resolver with frontmatter and first-line fallback"
```

---

## Task 3: Filename sanitizer (TDD)

**Files:**
- Create: `src/sanitize.ts`
- Create: `tests/sanitize.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/sanitize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeFilename, uniqueFilename } from "../src/sanitize";

describe("sanitizeFilename", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeFilename("  Hello   world  ")).toBe("Hello world");
  });
  it("replaces forbidden characters with single space", () => {
    expect(sanitizeFilename(`a/b\\c:d*e?f"g<h>i|j`)).toBe("a b c d e f g h i j");
  });
  it("strips leading hashes", () => {
    expect(sanitizeFilename("### Title")).toBe("Title");
  });
  it("returns 'untitled' when result is empty", () => {
    expect(sanitizeFilename("///")).toBe("untitled");
    expect(sanitizeFilename("   ")).toBe("untitled");
  });
});

describe("uniqueFilename", () => {
  it("returns base when no taken paths", () => {
    expect(uniqueFilename("Foo", new Set())).toBe("Foo");
  });
  it("returns Foo 2 when Foo is taken", () => {
    expect(uniqueFilename("Foo", new Set(["Foo"]))).toBe("Foo 2");
  });
  it("returns Foo 3 when Foo and Foo 2 are taken", () => {
    expect(uniqueFilename("Foo", new Set(["Foo", "Foo 2"]))).toBe("Foo 3");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/sanitize.ts`**

```ts
// Filename helpers: sanitize and uniqueness against a taken-set.

const FORBIDDEN_RE = /[\/\\:*?"<>|]/g;

export function sanitizeFilename(input: string): string {
  const cleaned = input
    .replace(/^#+\s*/, "")
    .replace(FORBIDDEN_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : "untitled";
}

export function uniqueFilename(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: 17 tests pass total (title + sanitize).

- [ ] **Step 5: Commit**

```bash
git add src/sanitize.ts tests/sanitize.test.ts
git commit -m "feat(sanitize): filename slug and uniqueness helpers"
```

---

## Task 4: Shared canvas types

**Files:**
- Create: `src/canvas.ts`

- [ ] **Step 1: Write the file**

```ts
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
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/canvas.ts
git commit -m "feat(canvas): shared types for canvas internals"
```

---

## Task 5: Settings module with migration

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: Write the file**

```ts
// Settings + tab + one-time migration from canvas-node-description's data.json.

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type CanvasNodesToolsPlugin from "../main";

export interface CntSettings {
  defaultBadgeColor: string;
  badgePosition: "top-right" | "top-left" | "top-center";
  badgeHiddenByDefault: boolean;
  titleModeOnByDefault: boolean;
  migrationNoticeShown: boolean;
}

export const DEFAULT_SETTINGS: CntSettings = {
  defaultBadgeColor: "4",
  badgePosition: "top-right",
  badgeHiddenByDefault: false,
  titleModeOnByDefault: true,
  migrationNoticeShown: false,
};

export async function migrateFromOldPlugin(
  app: App,
  current: CntSettings,
): Promise<CntSettings> {
  if (current.migrationNoticeShown) return current;

  // Old plugin id was canvas-node-description.
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

    containerEl.createEl("h3", { text: "Title mode" });

    new Setting(containerEl)
      .setName("Enable title-mode by default for new file nodes")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.titleModeOnByDefault)
          .onChange(async (v) => {
            this.plugin.settings.titleModeOnByDefault = v;
            await this.plugin.saveSettings();
          }),
      );

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
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: errors mentioning the missing `main.ts` import — that's expected, will be resolved in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat(settings): settings tab and migration from old plugin"
```

---

## Task 6: Plugin entry skeleton

**Files:**
- Create: `main.ts`

- [ ] **Step 1: Write `main.ts`**

```ts
// Plugin entry: lifecycle, settings, command registration. Feature modules attach to canvases.

import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  CntSettings,
  DEFAULT_SETTINGS,
  migrateFromOldPlugin,
  CntSettingsTab,
} from "./src/settings";

export default class CanvasNodesToolsPlugin extends Plugin {
  settings: CntSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.settings = await migrateFromOldPlugin(this.app, this.settings);
    await this.saveSettings();

    this.addSettingTab(new CntSettingsTab(this.app, this));

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

  private attachLeaf(_leaf: WorkspaceLeaf): void {
    // To be filled in by feature tasks.
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles to `main.js` without errors.

- [ ] **Step 3: Commit**

```bash
git add main.ts
git commit -m "feat: plugin entry skeleton with settings load and migration"
```

---

## Task 7: Description badge — port and wire up

**Files:**
- Create: `src/description.ts`
- Create: `src/modal-description.ts`
- Modify: `main.ts`
- Create: `styles.css` (initial section)

- [ ] **Step 1: Port `src/description.ts`** from `~/canvas-node-description/main.ts`. Wrap it as a class `DescriptionFeature` with methods `attachToCanvas(canvas: CanvasMin)` and `applyToNode(node: CanvasNodeMin)`. Drop the global toggle button (we keep the eye icon — same code) and the popup tag button. Public API:

```ts
export class DescriptionFeature {
  constructor(plugin: CanvasNodesToolsPlugin);
  attachToCanvas(canvas: CanvasMin): void;
  applyAll(canvas: CanvasMin): void;
  // Used by the popup-menu integration:
  openModalForNode(canvas: CanvasMin, node: CanvasNodeMin): void;
}
```

Reuse the `applyToNode` logic that sets `data-cnd-text`, `data-cnd-color`, custom `--cnd-color`. Drop `data-cnd-compact` entirely (Compact is gone).

- [ ] **Step 2: Port `src/modal-description.ts`** verbatim from the existing modal (text input, swatches, hex picker). Update class import paths.

- [ ] **Step 3: Port the badge CSS** (preview, swatches, position variants, hidden toggle) into `styles.css`. Drop the compact mode rules.

- [ ] **Step 4: Wire it up in `main.ts`**

```ts
import { DescriptionFeature } from "./src/description";
// in onload:
this.descriptionFeature = new DescriptionFeature(this);
// in attachLeaf:
const view = leaf.view as unknown as CanvasViewMin;
const canvas = view.canvas;
if (canvas) this.descriptionFeature.attachToCanvas(canvas);
```

- [ ] **Step 5: Manual smoke test**

1. Build: `npm run build`.
2. Copy `main.js manifest.json styles.css` to `<vault>/.obsidian/plugins/obsidian-canvas-nodes-tools/`.
3. Disable old plugin, enable new one.
4. Open `Supermarket v2.canvas`. Verify description badges still render with same colors and positions. Verify the eye icon in the right toolbar still toggles them.
5. Add a description to a fresh node via the tag icon — modal opens, swatches work, badge appears.

- [ ] **Step 6: Commit**

```bash
git add src/description.ts src/modal-description.ts styles.css main.ts
git commit -m "feat(description): port description feature from canvas-node-description"
```

---

## Task 8: Title-mode core — DOM apply + resolver wiring

**Files:**
- Create: `src/title-mode.ts`
- Modify: `main.ts`
- Modify: `styles.css`

- [ ] **Step 1: Create `src/title-mode.ts`**

```ts
// Title-mode: per-canvas attach, scan nodes, render title text via data attributes.

import { TFile, MetadataCache, Vault } from "obsidian";
import { resolveTitle, stripFrontmatter } from "./title";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

const DATA_ENABLED = "data-cnt-title-mode";
const DATA_TEXT = "data-cnt-title-text";

export class TitleModeFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    if ((canvas as unknown as { _cntAttached?: boolean })._cntAttached) {
      this.applyAll(canvas);
      return;
    }
    (canvas as unknown as { _cntAttached: boolean })._cntAttached = true;
    this.applyAll(canvas);

    // Re-render titles when the file changes externally.
    const evt = this.plugin.app.metadataCache.on("changed", (file) => {
      for (const [, node] of canvas.nodes) {
        if (this.fileForNode(node)?.path === file.path) {
          this.applyToNode(node);
        }
      }
    });
    this.plugin.registerEvent(evt);
  }

  applyAll(canvas: CanvasMin): void {
    for (const [, node] of canvas.nodes) this.applyToNode(node);
  }

  async applyToNode(node: CanvasNodeMin): Promise<void> {
    const data = node.getData();
    const file = this.fileForNode(node);
    const enabled = data.titleMode !== false && data.type === "file" && file !== null;
    const el = node.nodeEl;

    if (!enabled) {
      el.removeAttribute(DATA_ENABLED);
      el.removeAttribute(DATA_TEXT);
      return;
    }

    el.setAttribute(DATA_ENABLED, "true");
    const title = await this.resolveForFile(file as TFile);
    el.setAttribute(DATA_TEXT, title);
  }

  private fileForNode(node: CanvasNodeMin): TFile | null {
    const data = node.getData();
    if (data.type !== "file" || !data.file) return null;
    const f = this.plugin.app.vault.getAbstractFileByPath(data.file);
    return f instanceof TFile ? f : null;
  }

  private async resolveForFile(file: TFile): Promise<string> {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};
    const content = await this.plugin.app.vault.cachedRead(file);
    const body = stripFrontmatter(content);
    return resolveTitle({ basename: file.basename, frontmatter: fm, body });
  }
}
```

- [ ] **Step 2: Add CSS in `styles.css`**

```css
/* Title-mode: render only the resolved title centered in the node body. */
.canvas-node[data-cnt-title-mode="true"] .canvas-node-content > * {
  display: none;
}
.canvas-node[data-cnt-title-mode="true"] .canvas-node-content {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 var(--size-4-3);
}
.canvas-node[data-cnt-title-mode="true"] .canvas-node-content::before {
  content: attr(data-cnt-title-text);
  display: block;
  width: 100%;
  font-size: 1.05em;
  font-weight: 600;
  color: var(--text-normal);
  white-space: normal;
  overflow-wrap: anywhere;
  pointer-events: auto;
  cursor: text;
}
.canvas-node[data-cnt-title-mode="true"] .markdown-embed > * {
  display: none;
}
.canvas-node[data-cnt-title-mode="true"] .markdown-embed-link {
  display: flex;
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 2;
}
```

The `data-cnt-title-text` attribute on `.canvas-node-content` is set by JS — we read it from `node.nodeEl` and propagate to the inner `.canvas-node-content` in `applyToNode` via a small helper.

Adjust `applyToNode`:

```ts
const inner = el.querySelector(".canvas-node-content");
if (inner) inner.setAttribute(DATA_TEXT, title);
```

- [ ] **Step 3: Wire up in `main.ts`**

```ts
import { TitleModeFeature } from "./src/title-mode";
// in onload (alongside descriptionFeature):
this.titleModeFeature = new TitleModeFeature(this);
// in attachLeaf:
if (canvas) this.titleModeFeature.attachToCanvas(canvas);
```

- [ ] **Step 4: Manual smoke test**

1. Build, copy to vault.
2. Open `Supermarket v2.canvas`. Each file node shows only its resolved title (frontmatter `node_title` → first line → basename).
3. Edit a note's `node_title` in another panel → canvas re-renders.

- [ ] **Step 5: Commit**

```bash
git add src/title-mode.ts main.ts styles.css
git commit -m "feat(title-mode): per-canvas attach, render resolved title"
```

---

## Task 9: Inline title editing

**Files:**
- Create: `src/inline-edit.ts`
- Modify: `main.ts`
- Modify: `styles.css`

- [ ] **Step 1: Create `src/inline-edit.ts`**

```ts
// Inline edit of a file node's node_title via contenteditable on dblclick of the body.

import { TFile, Notice } from "obsidian";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export class InlineEditFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    if ((canvas as unknown as { _cntInlineAttached?: boolean })._cntInlineAttached) return;
    (canvas as unknown as { _cntInlineAttached: boolean })._cntInlineAttached = true;

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
      // Re-resolve from file to honor frontmatter formatting:
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

    inner.addEventListener("blur", () => commit(), { once: true });
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
    const f = this.plugin.app.vault.getAbstractFileByPath(data.file);
    return f instanceof TFile ? f : null;
  }
}
```

- [ ] **Step 2: Add CSS in `styles.css`**

```css
.canvas-node[data-cnt-title-mode="true"] .canvas-node-content.cnt-editing {
  outline: 2px solid var(--interactive-accent);
  outline-offset: -2px;
  border-radius: var(--radius-s);
  background-color: var(--background-primary);
  cursor: text;
  user-select: text;
}
.canvas-node[data-cnt-title-mode="true"] .canvas-node-content.cnt-editing::before {
  content: none;
}
```

- [ ] **Step 3: Wire up in `main.ts`**

```ts
import { InlineEditFeature } from "./src/inline-edit";
// in onload:
this.inlineEditFeature = new InlineEditFeature(this);
// in attachLeaf:
if (canvas) this.inlineEditFeature.attachToCanvas(canvas);
```

- [ ] **Step 4: Manual smoke test**

1. Open canvas, double-click a file node body.
2. Outline appears, text is selected.
3. Type new title, press Enter → frontmatter updates, title renders new value.
4. Double-click again, type something, press Esc → original value back.
5. Double-click, clear text, press Enter → `node_title` removed; falls back to first line.

- [ ] **Step 5: Commit**

```bash
git add src/inline-edit.ts main.ts styles.css
git commit -m "feat(inline-edit): contenteditable title with Enter/Esc/blur lifecycle"
```

---

## Task 10: Header link → new tab

**Files:**
- Create: `src/header-link.ts`
- Modify: `main.ts`

- [ ] **Step 1: Create `src/header-link.ts`**

```ts
// Intercept dblclick on a file node's embed header to open the note in a new tab.

import { TFile, Notice } from "obsidian";
import type { CanvasMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export class HeaderLinkFeature {
  constructor(private plugin: CanvasNodesToolsPlugin) {}

  attachToCanvas(canvas: CanvasMin): void {
    if ((canvas as unknown as { _cntHeaderAttached?: boolean })._cntHeaderAttached) return;
    (canvas as unknown as { _cntHeaderAttached: boolean })._cntHeaderAttached = true;

    this.plugin.registerDomEvent(
      canvas.wrapperEl,
      "dblclick",
      (event) => this.onDblClick(event),
      { capture: true },
    );
  }

  private onDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const linkEl = target.closest(
      ".markdown-embed-link, .canvas-node-label",
    ) as HTMLElement | null;
    if (!linkEl) return;

    const nodeEl = linkEl.closest(".canvas-node") as HTMLElement | null;
    if (!nodeEl) return;

    // Resolve the file path from the wikilink href or the data-href.
    const href =
      linkEl.getAttribute("href") ??
      linkEl.getAttribute("data-href") ??
      this.findFileFromNodeEl(nodeEl);
    if (!href) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const sourcePath = "";
    const linktext = href;

    // Activate existing tab if present, otherwise open new tab.
    const existing = this.findExistingLeaf(linktext);
    if (existing) {
      this.plugin.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }

    void this.plugin.app.workspace.openLinkText(linktext, sourcePath, "tab");
  }

  private findFileFromNodeEl(nodeEl: HTMLElement): string | null {
    // Fallback: read the data-id attribute and look up the canvas node — out of scope here.
    return nodeEl.getAttribute("data-href");
  }

  private findExistingLeaf(linktext: string) {
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linktext, "");
    if (!file) return null;
    let found: ReturnType<typeof this.plugin.app.workspace.getLeavesOfType>[number] | null = null;
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const v = leaf.view as unknown as { file?: TFile };
      if (v?.file?.path === file.path) found = leaf;
    });
    return found;
  }
}
```

- [ ] **Step 2: Wire up in `main.ts`**

```ts
import { HeaderLinkFeature } from "./src/header-link";
// register and attach analogously to other features.
```

Order matters: `inline-edit` and `header-link` both listen at capture phase. Both filter by target. They are mutually exclusive (header click never overlaps body click).

- [ ] **Step 3: Manual smoke test**

1. Double-click the embed-header link of a file node → opens the note in a new tab.
2. Repeat → no duplicate tab; activates the existing one.

- [ ] **Step 4: Commit**

```bash
git add src/header-link.ts main.ts
git commit -m "feat(header-link): dblclick on embed header opens note in new tab"
```

---

## Task 11: Cmd+L command — toggle title-mode

**Files:**
- Modify: `main.ts`

- [ ] **Step 1: Register the command in `onload`**

```ts
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

    const next = data.titleMode === false ? true : false;
    node.setData({ ...data, titleMode: next === true ? undefined : false });
    void this.titleModeFeature.applyToNode(node);
    canvas.requestSave?.();
    return true;
  },
});
```

Helpers (also in `main.ts`):

```ts
private getActiveCanvas(): CanvasMin | null {
  const leaf = this.app.workspace.getActiveViewOfType(/* ItemView */ ItemView);
  // Better: getLeaf typecheck:
  for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
    if (leaf === this.app.workspace.activeLeaf) {
      return (leaf.view as unknown as CanvasViewMin).canvas ?? null;
    }
  }
  return null;
}

private getSingleSelectedNode(canvas: CanvasMin): CanvasNodeMin | null {
  if (!canvas.selection || canvas.selection.size !== 1) return null;
  for (const item of canvas.selection) {
    const cand = item as Partial<CanvasNodeMin> & { path?: unknown };
    if (cand.path !== undefined) return null; // edges have .path
    if (typeof cand.getData === "function") return cand as CanvasNodeMin;
  }
  return null;
}
```

Note: when toggling **on**, we delete `titleMode` (default ON). When toggling **off**, we explicitly set `titleMode: false`.

- [ ] **Step 2: Manual smoke test**

1. Select a file node, press Cmd+L → switches to full content view.
2. Press Cmd+L again → back to title-mode.
3. Multi-select two nodes, Cmd+L → no-op (checkCallback returns false).

- [ ] **Step 3: Commit**

```bash
git add main.ts
git commit -m "feat(command): Cmd+L toggles title-mode on selected file node"
```

---

## Task 12: Cmd+K command — convert text → file

**Files:**
- Create: `src/convert-text-to-file.ts`
- Modify: `main.ts`

- [ ] **Step 1: Create `src/convert-text-to-file.ts`**

```ts
// Convert a selected text node into a real .md file in the canvas's directory.

import { Notice, TFile } from "obsidian";
import { sanitizeFilename, uniqueFilename } from "./sanitize";
import type { CanvasMin, CanvasNodeMin } from "./canvas";
import type CanvasNodesToolsPlugin from "../main";

export async function convertTextNodeToFile(
  plugin: CanvasNodesToolsPlugin,
  canvas: CanvasMin,
  node: CanvasNodeMin,
): Promise<void> {
  const data = node.getData();
  if (data.type !== "text") {
    new Notice("Only text nodes can be converted");
    return;
  }
  const text = (data.text ?? "").trim();
  if (text.length === 0) {
    new Notice("Empty text node — type something first");
    return;
  }

  const lines = text.split("\n");
  const firstLineIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLine = lines[firstLineIdx]?.trim() ?? "";
  const cleanedTitle = firstLine.replace(/^#+\s*/, "").trim();

  const slug = sanitizeFilename(cleanedTitle);
  const canvasFile = canvas.view?.file;
  if (!canvasFile) {
    new Notice("Couldn't determine the canvas file path");
    return;
  }
  const dir = canvasFile.parent?.path ?? "";

  // Collect taken slugs (without .md) under dir.
  const taken = new Set<string>();
  const folder = plugin.app.vault.getFolderByPath(dir);
  if (folder) {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        taken.add(child.basename);
      }
    }
  }
  const finalSlug = uniqueFilename(slug, taken);
  const targetPath = dir.length > 0 ? `${dir}/${finalSlug}.md` : `${finalSlug}.md`;

  const restBody = lines.slice(firstLineIdx + 1).join("\n").trim();
  const initial = [
    "---",
    `node_title: "${cleanedTitle.replace(/"/g, '\\"')}"`,
    "---",
    "",
    `# ${cleanedTitle}`,
    restBody.length > 0 ? `\n${restBody}` : "",
  ].join("\n");

  const newFile = await plugin.app.vault.create(targetPath, initial);

  node.setData({
    ...data,
    type: "file",
    file: newFile.path,
    text: undefined,
  });

  // Re-render via title-mode and description features.
  void plugin.titleModeFeature.applyToNode(node);
  canvas.requestSave?.();
  new Notice(`Created ${newFile.path}`);
}
```

- [ ] **Step 2: Register the command in `main.ts`**

```ts
import { convertTextNodeToFile } from "./src/convert-text-to-file";

// in onload:
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
```

- [ ] **Step 3: Manual smoke test**

1. Create a text node with multiple lines in a canvas at vault root.
2. Press Cmd+K → file `<first line>.md` is created at vault root, edges intact, node now shows title-mode.
3. Repeat with same text → file `<first line> 2.md` is created.
4. Cmd+K with empty text node → Notice; nothing created.

- [ ] **Step 4: Commit**

```bash
git add src/convert-text-to-file.ts main.ts
git commit -m "feat(command): Cmd+K converts text node to .md file in canvas folder"
```

---

## Task 13: Popup-menu buttons

**Files:**
- Modify: `main.ts`
- Possibly: extract a small `src/popup-menu.ts` if `main.ts` grows past ~200 lines.

- [ ] **Step 1: Add MutationObserver on `canvas.menu.menuEl`** (mirroring the description plugin pattern). Inside the observer:

- For file nodes: insert a `Toggle title-mode` button (icon `book-open` if currently on, `text-cursor-input` if off; tooltip switches accordingly). On click → invoke the command logic.
- For text nodes: insert a `Convert to file` button (icon `file-plus`). On click → invoke `convertTextNodeToFile`.
- Description tag button stays (already injected by `DescriptionFeature`).

Detect node type by reading `node.getData().type` (where `node` is found via the canvas.selection set).

- [ ] **Step 2: Manual smoke test**

1. Select a file node → both tag and toggle title-mode buttons appear in the popup.
2. Click toggle → title-mode flips visually.
3. Select a text node → "Convert to file" button appears. Click → conversion fires.

- [ ] **Step 3: Commit**

```bash
git add main.ts # or src/popup-menu.ts if extracted
git commit -m "feat(menu): popup-menu buttons for title-mode toggle and text-to-file"
```

---

## Task 14: Default title-mode for new file nodes

**Files:**
- Modify: `src/title-mode.ts`

- [ ] **Step 1: In `applyToNode`, treat a node with `type === "file"` and `titleMode === undefined` as ON.

The current logic (`data.titleMode !== false`) already does this — verify the check still resolves to ON for fresh nodes (created by drag&drop or by the conversion command).

- [ ] **Step 2: Manual smoke test**

1. Drag a `.md` file onto an open canvas → node appears already in title-mode.
2. Cmd+K converts a text node → resulting file node is in title-mode.

(No code changes likely needed; this task verifies behavior.)

- [ ] **Step 3: Commit (only if changes)**

```bash
git add src/title-mode.ts
git commit -m "test: verify title-mode default for newly created file nodes"
```

If no changes needed, skip the commit and document the verification in the PR description.

---

## Task 15: Polish — README and release artifacts

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write a README** that covers:

- What it does (badges + title-mode + Cmd+K + Cmd+L).
- Installation (manual zip from releases; from-source instructions).
- Migration from `canvas-node-description` (one-time notice; safe to uninstall the old).
- Known limitations (relies on undocumented canvas internals; see spec).
- License (MIT).

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with install, usage and migration"
```

---

## Task 16: Release pipeline (manual)

- [ ] **Step 1: Build production bundle**

Run: `npm run build`
Verify: `main.js` is minified and source maps are absent.

- [ ] **Step 2: Create GitHub repo and push**

```bash
gh repo create obsidian-canvas-nodes-tools --public \
  --source=. --remote=origin \
  --description="Obsidian canvas plugin: title-mode, inline editing, descriptions, text→file conversion." \
  --push
```

- [ ] **Step 3: Tag release**

```bash
git tag -a 1.0.0 -m "1.0.0"
git push origin 1.0.0
```

- [ ] **Step 4: Attach release assets**

Use `gh release create 1.0.0 main.js manifest.json styles.css --notes "Initial release"` to publish the three required files.

- [ ] **Step 5: Local install and final smoke test** (re-run the testing checklist from spec § "Testing checklist (manual)").

---

## Done criteria

- [ ] All vitest unit tests pass: `npm test` reports `17 tests passed`.
- [ ] `npm run build` produces a working `main.js`.
- [ ] Manual smoke checklist from the spec (12 items) all pass on a real Obsidian instance.
- [ ] Old `canvas-node-description` settings migrate on first run; one-time notice appears.
- [ ] `Supermarket v2.canvas` opens with all nodes in title-mode showing the resolved title.
- [ ] `Cmd+L` toggles, `Cmd+K` converts, header dblclick opens new tab — verified manually.

## Out of scope (will not implement)

- Bulk operations.
- Title-mode for non-file nodes.
- Localization.
- Automated DOM/integration tests (manual checklist suffices for v1).
