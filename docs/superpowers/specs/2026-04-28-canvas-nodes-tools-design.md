# Canvas Nodes Tools — Design Spec

**Date:** 2026-04-28
**Author:** Raulyn Polanco
**Status:** Approved (ready for implementation plan)

## Context

The current plugin `canvas-node-description` (https://github.com/elsuper88/canvas-node-description) provides:

- Description badge above any canvas node (text or color)
- Global show/hide toggle on the canvas card menu
- A "Compact" mode that hides every block of a file node's preview except the first heading

The user wants to extend the plugin with:

- A real **title-mode** for file nodes that shows a single, **inline-editable** title
- Title resolution from a `node_title` frontmatter attribute, falling back to the first non-empty line of the note
- A keyboard shortcut to convert plain `text` nodes into `.md` files
- Cleaner double-click semantics: cuerpo → edit, header → open note in new tab

The decision is to **rename and replace** the current plugin rather than maintain two. The new plugin is `obsidian-canvas-nodes-tools`. Compact mode is removed; title-mode covers the same use case and adds editing.

## What it does

### Title mode (file nodes)

A file node in title-mode shows only a clean, editable title. The body (rest of the note) is hidden.

The title is resolved in this order:

1. `node_title` from the note's frontmatter, if present.
2. First non-empty line of the body (after frontmatter), with leading `#` characters stripped if it was a heading.
3. The file's `basename` (filename without extension), as a final fallback.

Title-mode is **on by default for newly created file nodes**. It can be toggled per-node via `Cmd+L` or via the popup menu.

### Inline title editing

Double-clicking on the **body of a file node** in title-mode makes the title element `contenteditable`. The user types directly — no overlay, no input field, behaves like a native text node:

- Focus is automatic, the existing title text is selected.
- `Enter` confirms — writes `node_title` to the note's frontmatter via `app.fileManager.processFrontMatter`.
- `Esc` reverts to the previous value.
- `Blur` (clicking outside) confirms.
- `Shift+Enter` is blocked — the title is single-line.
- Empty value at confirm → removes `node_title` from frontmatter; the fallback chain takes over.

### Header link → new tab

Double-clicking on the **embed header** (the small bar at the top of a file node showing the filename / wikilink) currently opens the note in the same canvas view. The plugin intercepts this and opens it in a new tab via `workspace.openLinkText(target, sourcePath, 'tab')`. If the note is already open in another tab, that tab is activated instead.

### Convert text → file (Cmd+K)

With a single text node selected, `Cmd+K`:

1. Reads the text content.
2. If empty, shows `Notice("Empty text node — type something first")` and aborts.
3. Computes filename: first non-empty line of the text, slugified — trims, replaces `/ \\ : * ? " < > |` with spaces, collapses repeated whitespace.
4. Resolves collisions by appending `2`, `3`, … to the filename.
5. Creates the `.md` file in the **same directory as the canvas** (`canvasFile.parent.path`).
6. Writes initial content:

   ```markdown
   ---
   node_title: "<first line>"
   ---

   # <first line>

   <rest of the text node body, if any>
   ```

7. Mutates the canvas node in place: keeps the same `id`, changes `type` from `text` to `file`, sets `file: "<path>"`. Edges connected to that `id` are preserved.
8. Title-mode for the new file node defaults to ON.

### Description badge (existing)

Unchanged from the current plugin. Coexists with title-mode without conflicts: badge sits above the node, title sits inside the node body.

### Keyboard shortcuts

| Command | Default hotkey | Active when |
|---|---|---|
| `Toggle title-mode` | `Cmd+L` | Single file node selected |
| `Convert text to file` | `Cmd+K` | Single text node selected |
| `Add/edit description` | (no default) | Single node selected |
| `Toggle all descriptions` | (no default) | Canvas open |

All four are rebindable through Settings → Hotkeys.

`Cmd+L` only operates on a single selection. With multi-selection it is a no-op (or a non-blocking notice).

### Popup menu (per-node toolbar)

| Node type | Buttons |
|---|---|
| File node | Tag (description, existing) + **Toggle title-mode** (icon `book-open` / `text-cursor-input`, tooltip switches between "Ver contenido completo" and "Ver solo título") |
| Text node | **Convert to file** (icon `file-plus`) |

### Card menu (right toolbar)

The existing eye icon (toggle all descriptions) stays. **No new icon** for title-mode — title-mode is per-node by design.

## Architecture

### File layout

```
obsidian-canvas-nodes-tools/
├── main.ts                       # Plugin entry, command registration, lifecycle
├── src/
│   ├── canvas.ts                 # Shared types: CanvasMin, CanvasNodeMin, CanvasMenuMin
│   ├── description.ts            # Description badge (port from canvas-node-description)
│   ├── title-mode.ts             # Title resolver, DOM apply, per-canvas attach
│   ├── inline-edit.ts            # contenteditable handler, Enter/Esc capture, persist
│   ├── header-link.ts            # Intercept dblclick on embed link, open in new tab
│   ├── convert-text-to-file.ts   # Cmd+K logic
│   ├── settings.ts               # Settings tab + load/migrate from old plugin
│   └── modal-description.ts      # Existing description modal (port)
├── styles.css                    # Badge + title-mode CSS + inline edit styles
├── manifest.json                 # id: "obsidian-canvas-nodes-tools"
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

### Persisted data

| Datum | Lives in | Why |
|---|---|---|
| `node_title` value | Note frontmatter | Single source of truth across canvases |
| Title-mode ON/OFF override | Canvas node JSON, field `titleMode: false` (only if OFF) | Default ON, store only the override to keep canvas files small |
| Description (text + color) | Canvas node JSON, field `description` | Same as current plugin, no migration of structure |

The previous `description.compact` field is no longer read or written. Old canvases that had `compact: true` are visually unchanged because title-mode is ON by default — the persisted `compact:true` is silently ignored on read and stripped on the next save.

### Canvas hooks

The plugin uses the same approach as the current one:

- `onLayoutReady` + `workspace.on('layout-change')` + `workspace.on('active-leaf-change')` to scan canvas leaves.
- A `WeakSet<CanvasMin>` tracks attached canvases to avoid re-binding handlers.
- A `MutationObserver` on `canvas.menu.menuEl` injects the per-node popup buttons when the menu rerenders.
- A `MutationObserver` on `canvas.wrapperEl` is added in this plugin for tracking newly-rendered file node DOM elements (so title-mode CSS attributes and the dblclick handlers can be applied).
- Double-click is captured at the wrapper level via `wrapperEl.addEventListener('dblclick', handler, { capture: true })`. The handler inspects `event.target` ancestry to decide:
  - If inside `.canvas-node-label` or `.markdown-embed-link` → open note in new tab, `event.stopPropagation()`, `event.preventDefault()`.
  - Else if inside a file node body and the node has title-mode ON → start inline edit.
  - Otherwise → let Obsidian handle it.

### Title resolver

```ts
async function resolveTitle(file: TFile): Promise<string> {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter
  if (fm?.node_title) return String(fm.node_title)
  const content = await app.vault.cachedRead(file)
  const body = stripFrontmatter(content)
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (!t) continue
    return t.replace(/^#+\s*/, '')
  }
  return file.basename
}
```

The resolver is invoked when:

- A file node is rendered (initial scan and subsequent layout changes).
- The user edits a title inline (after persisting we resolve again to confirm).
- The vault `metadataCache` fires `changed` for the file (covers external edits).

### Title persist

```ts
await app.fileManager.processFrontMatter(file, fm => {
  if (newValue.trim().length === 0) delete fm.node_title
  else fm.node_title = newValue.trim()
})
```

This API:
- Creates frontmatter if missing.
- Preserves existing keys and order.
- Triggers `metadataCache.on('changed')` automatically, so other open views update.

### Convert text → file

```ts
async function convertTextToFile(canvas: CanvasMin, node: CanvasNodeMin): Promise<void> {
  const data = node.getData()
  if (data.type !== 'text') return
  const text = (data.text || '').trim()
  if (!text) { new Notice("Empty text node — type something first"); return }

  const firstLine = text.split('\n').find(l => l.trim().length > 0) ?? ''
  const cleanedTitle = firstLine.replace(/^#+\s*/, '').trim()
  const slug = sanitizeFilename(cleanedTitle)
  const canvasFile = ... // resolved from active leaf
  const dir = canvasFile.parent?.path ?? ''
  const filename = await uniqueFilename(dir, slug)
  const restBody = text.split('\n').slice(text.split('\n').findIndex(l => l.trim().length > 0) + 1).join('\n').trim()

  const initial = [
    '---',
    `node_title: "${escape(cleanedTitle)}"`,
    '---',
    '',
    `# ${cleanedTitle}`,
    '',
    restBody,
  ].join('\n')

  const newFile = await app.vault.create(filename, initial)

  // Mutate the canvas node in place — preserves id and edges
  node.setData({ ...data, type: 'file', file: newFile.path, text: undefined })
  canvas.requestSave?.()
}
```

`sanitizeFilename`: replaces `/ \\ : * ? " < > |` with single space, trims, collapses spaces.
`uniqueFilename(dir, slug)`: returns `${dir}/${slug}.md`, then `${slug} 2.md`, etc.

## Migration

### Plugin install / first run

On first `onload`:

1. Read `~/.obsidian/plugins/canvas-node-description/data.json` (the old settings).
2. If found and the new plugin's `data.json` doesn't exist yet:
   - Copy applicable fields (`defaultColor`, `position`, `hiddenByDefault`).
   - Save as new `data.json`.
3. Show a one-time `Notice`: *"Canvas Node Description fue reemplazado por Canvas Nodes Tools. Ya podés desinstalarlo desde Settings."*
4. Persist a flag `migrationNoticeShown: true` so it only fires once.

### Per-node migration

Read-time:
- A node with `description.compact === true`: ignored. The visual outcome is the same because title-mode is ON by default.

Write-time (only when the user edits something on the node):
- Strip `description.compact` from the saved JSON. This keeps the canvas file clean over time.

No bulk migration script — the next time the user touches a node, that node is updated.

## Edge cases

### Title-mode

| Case | Behavior |
|---|---|
| `node_title` doesn't exist | Resolver falls back to first line; on first edit, frontmatter is created with `node_title` |
| User clears the field | `processFrontMatter` deletes `node_title`; falls back to first line |
| Title contains markdown (e.g. `**bold**`) | Persisted literally; rendered as plain text in the node (no markdown parsing) |
| Note open in another pane during edit | `processFrontMatter` updates the file; Obsidian re-renders both views |
| Note is deleted while editing | `Notice("File no longer exists")`, edit aborts, no changes |
| File node points to a missing file | Title-mode shows the basename; inline edit is disabled (no target to write to) |

### Convert (Cmd+K)

| Case | Behavior |
|---|---|
| Empty text node | Notice "Empty text node — type something first"; no file created |
| Text node with multiple lines | Filename and `node_title` use only the first non-empty line; remaining lines are appended below the H1 in the new file |
| Filename collision | Append numeric suffix (`Foo 2.md`, `Foo 3.md`, …) until free |
| Canvas at vault root | New `.md` is created at vault root |
| Canvas inside subfolder | New `.md` created in the same subfolder |
| Canvas inside subfolder, subfolder name has special chars | Irrelevant — only the *new* file's name is sanitized; the parent path is used as-is |
| Text node inside a group | Type changes from text to file; group containment unchanged; edges preserved |

### Header double-click

| Case | Behavior |
|---|---|
| Note already open in another tab | Activate that tab (no duplicate) |
| Note is in pinned tab | Open new tab anyway (Obsidian's `openLinkText('tab')` respects this) |
| File node points to missing file | Notice "File not found", no tab opened |

## Testing checklist (manual)

Run before each release:

1. Create a file node by dropping a `.md` file → it shows in title-mode with the resolved title.
2. Double-click the body → editable. Type "Nuevo título" → Enter. Verify frontmatter updated.
3. Double-click the body → Esc. Verify reverts.
4. Edit the title to empty → Enter. Verify `node_title` removed and fallback shown.
5. Double-click the embed header link → opens the note in a new tab (or activates existing tab).
6. Cmd+L on a file node → toggles to full content view; press again → back to title.
7. Cmd+L on a multi-selection → no-op (or notice).
8. Type "Mi paso" in a new text node, Cmd+K → file `Mi paso.md` created in canvas folder, edges preserved.
9. Cmd+K with empty text node → Notice, no file created.
10. Cmd+K twice with same title → second file is `Mi paso 2.md`.
11. Open `Supermarket v2.canvas` after install → all nodes still display as title cards (migration verified).
12. Description badge still works — color, hide-all toggle.

## Out of scope

- Bulk operations (rename multiple titles at once, batch convert).
- Title-mode for non-file nodes (text, group, link). Title-mode is meaningful only for file nodes.
- Custom title formatting per-node (font size override, color). Use the `description` badge for that.
- Localization. The plugin ships in English; we can add Spanish strings later if there's appetite.
- Sync with Outline plugin or Dataview — they read frontmatter directly and benefit automatically without integration code.

## Risks / open questions

- **Obsidian internals**: title-mode and inline editing rely on internal canvas DOM (`.canvas-node-content`, `.markdown-embed`, `.canvas-node-label`). If Obsidian changes those, the plugin breaks. Mitigation: defensive selectors, console warnings on missing elements, watch upstream releases.
- **`canvas.requestSave` undocumented**: same caveat. The current plugin already depends on it; carry over.
- **Race condition on double-click**: a file node's `dblclick` may fire before our capture handler if Obsidian binds at the same level. Capture phase + `event.stopImmediatePropagation()` should win, but verify in Obsidian 1.5+.

## Next step

Invoke the `superpowers:writing-plans` skill to produce a step-by-step implementation plan with checkpoints.
