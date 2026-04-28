# Canvas Nodes Tools

An Obsidian plugin that enhances canvas file nodes with title-mode display, inline editing, description badges, and a text-to-file conversion command.

Replaces [canvas-node-description](https://github.com/elsuper88/canvas-node-description).

---

## Features

### Title-mode for file nodes

Collapses a canvas file-node embed into a compact title bar showing only the note title.

- **Double-click the body** — edit the note's content inline without leaving the canvas.
- **Double-click the header** — open the note in a new tab.
- **Cmd+L** (rebindable) — toggle title-mode on the currently selected file node.
- A button in the node's pop-up menu also toggles title-mode.

#### Title resolution priority

1. `node_title` frontmatter field in the linked note.
2. First non-empty body line (heading `#` hashes are stripped).
3. File basename.

### Description badges

Attach a short text label — with a custom color — to any node (file, text, group, link).

- Configure text and color per node via the node's pop-up menu.
- A **global show/hide toggle** in the pop-up menu hides all badges canvas-wide without deleting them.

### Text node → Markdown file (Cmd+K)

Select a text node on the canvas and press **Cmd+K** (rebindable). The plugin:

1. Creates a `.md` file in the same folder as the canvas file.
2. Writes the text-node content into the new file.
3. Replaces the text node with a file node pointing to the new file.

---

## Installation

### Manual (recommended for now)

1. Build or download the release assets: `main.js`, `manifest.json`, `styles.css`.
2. Create the folder `<vault>/.obsidian/plugins/obsidian-canvas-nodes-tools/`.
3. Copy the three files into that folder.
4. In Obsidian: **Settings → Community plugins → Reload plugins**, then enable **Canvas Nodes Tools**.

### From source

```bash
git clone https://github.com/elsuper88/obsidian-canvas-nodes-tools.git
cd obsidian-canvas-nodes-tools
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, `styles.css` into your vault's plugin folder as above.

---

## Hotkeys

| Action | Default |
|--------|---------|
| Toggle title-mode on selected node | Cmd+L |
| Convert text node to .md file | Cmd+K |

Both hotkeys are rebindable under **Settings → Hotkeys → Canvas Nodes Tools**.

---

## Migration from canvas-node-description

On first run the plugin automatically migrates all per-node settings stored by the old plugin:

- Description text and color are preserved.
- The `compact` field is dropped — title-mode replaces it.

A one-time notice in Obsidian tells you to uninstall **canvas-node-description** after migration. The two plugins should not run simultaneously.

---

## Known limitations

- Relies on Obsidian's internal canvas API (`canvas.menu`, `canvas.cardMenuEl`, `canvas.selection`). These are undocumented and may change in future Obsidian releases.
- Title-mode applies only to **file nodes** (embedded notes). Text, group, and link nodes are unaffected.

---

## License

MIT — see [LICENSE](LICENSE).
