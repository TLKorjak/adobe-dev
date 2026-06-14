# TC Markers — Premiere Pro UXP panel

Dockable panel for Premiere Pro 2026. Loads a transcript **.docx**, finds the
**yellow-highlighted syncs**, and drops a colored **comment marker** on the
active sequence for each one — default **red**, with the first 5 words of the
highlighted text as the marker comment. Non-highlighted timecodes are ignored.

No terminal, no bridge — a self-contained panel.

## Files
- `manifest.json` — plugin id `tv.promots.tc-markers`, panel entrypoint.
- `index.html` / `index.js` — UI + glue.
- `docxParse.js` — `word/document.xml` → `[{tc, hl, comment}]` (regex, no DOM).
- `markers.js` — applies markers to the active sequence (validated UXP pattern).
- `lib/fflate.min.js` — unzip (a .docx is a ZIP).
- `icons/` — panel icons.

## How it works
1. Pick a `.docx` → read bytes → `fflate.unzipSync` → `word/document.xml`.
2. Walk the table; carry the `tc` per row; a run is highlighted if it has
   `w:highlight="yellow"` (Word) or a yellow `w:shd` fill (Google Docs).
3. For each highlighted sync: marker at `tc − sequence.zeroPoint` (25 fps),
   color = selected index (default red 1), comment = first 5 words.
4. Frame-dedupe; clamp `<0`; skip beyond sequence end.

## Load in Premiere (UDT, for development)
1. Premiere Pro → **Settings ▸ General ▸ Enable Developer Mode** (if present); restart.
2. Open **UXP Developer Tool (UDT)** v2.2+.
3. **Add Plugin** → select `tc-marker-tool/manifest.json`.
4. Click **Load** (the ••• menu also has **Load**). The panel appears under
   **Window ▸ Extensions (or UXP) ▸ TC Markers** — dock it anywhere.
5. After editing source: **Reload** from UDT (no Premiere restart needed).

## Use
1. Open the project; make the target sequence active (panel shows its name; ↻ refreshes).
2. **Click the upload area** → choose a `.docx`. The panel reports highlighted count / tc rows / range.
3. Pick a color, toggle clear-first vs append, **Drop markers**. Result + an expandable JSON log appear at the bottom.

## UI
Dark "Serene Utility" design adapted from `ref_design/stitch_minimalist_adobe_plugin_redesign`.
Styling is baked plain CSS. **Inter** is bundled locally (`fonts/inter-{400,500,600}.woff2`,
loaded via `@font-face`) so type renders identically on every machine — CDN fonts are
unreliable in UXP, but local bundled fonts work. Icons are **text glyphs** (↻ ↑ ✓ ▾) because
UXP drops several SVG path commands; the panel icon (`icons/`) is a flag marker PNG.
Buttons are `<div role="button">` (plain `<button>` carries native chrome UXP won't let you
restyle). `<select>` may still render with the host's native chrome.

## Validation status
- DOCX parse + unzip pipeline validated under node against
  `rivlin_transcript_selected_syncs.docx` → 216 tc rows, 44 highlighted.
- Marker add / color-by-index / comment + color-index map validated
  on sequence "Rubi Rivlin_camA_markers".
- **Deployed and run successfully on a second machine** via the `dist/` bundle below.

## Packaging & deployment (.ccx)
The plugin ships as a `.ccx` (a zip with `manifest.json` at the root). Two ways to build:
- **UDT** (**••• ▸ Package**) → dev-signed `.ccx`, installs **without** Developer Mode.
- **Self-zip** (what `dist/` contains) → unsigned `.ccx`; target machines need Premiere
  **Developer Mode** enabled.

### `dist/` — ready-to-hand-off bundle
- `dist/tc-markers.ccx` — built from the plugin root.
- `dist/INSTALL.md` — end-user guide (install = right-click the `.ccx` →
  **Open With ▸ UnifiedPluginInstallerAgent.app**; UPIA ships with Creative Cloud).
- `dist/TC-Markers-plugin.zip` — the two above, zipped for distribution.

Rebuild after any change:
```
cd tc-marker-tool
zip -r -X dist/tc-markers.ccx manifest.json index.html index.js docxParse.js markers.js lib icons fonts -x '.*'
cd dist && zip -j -X TC-Markers-plugin.zip tc-markers.ccx INSTALL.md
```
Bump `version` in `manifest.json` each build so UPIA treats it as an update.
For no-Developer-Mode, machine-wide install, use a UDT-signed `.ccx` or a private
Adobe Exchange listing instead — see the Dev Plan.
