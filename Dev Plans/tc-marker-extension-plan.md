# TC Marker Tool — Premiere Dockable Extension Plan (DOCX-primary)

**Status:** Core pipeline validated end-to-end (see "Validated this session"). Panel not yet built.
**Updated:** 2026-06-14
**Goal:** An **independent, deployable UXP tool** for Premiere Pro 2026 — a dockable panel that loads a transcript **.docx**, finds the **yellow-highlighted syncs**, and drops a sequence marker on the active timeline for **each highlighted sync only**: **red (color 1) + a comment** (first 5 words of the highlighted text). Non-highlighted timecodes are ignored. Self-contained (no terminal, no `send.sh`, no eval bridge), installable on multiple Premiere machines.

---

## Terminology: "extension" vs "plugin"

In PPro 2026 these are the same thing: a dockable panel **is** a **UXP plugin with a `panel` entrypoint** — it appears under the Window menu and docks like a native panel. The old CEP/ZXP "Extension" is deprecated and would lose modern file APIs. So this *is* the extension, built the supported way.

---

## Input format decision: DOCX-primary

The fragile part of the original idea was reading **yellow** out of a PDF — color there is either a real annotation or baked-in paint, and the baked case needs page rendering + pixel detection. **DOCX removes that problem entirely:** highlighting is an explicit attribute on the text run.

```xml
<w:r>
  <w:rPr><w:highlight w:val="yellow"/></w:rPr>   <!-- Word highlighter pen -->
  <w:t>the selected sync text…</w:t>
</w:r>
```
(Google Docs export uses `<w:shd w:fill="FFFF00"/>` instead — both detected.)

Text and highlight travel together → no rendering, no geometry mapping, Hebrew/RTL intact.

| Format | Keeps "highlight with a pen" UX | Text↔highlight link | Rendering | Verdict |
|---|---|---|---|---|
| **DOCX (highlighter)** | ✅ | direct (same run) | none | **primary** |
| CSV / Google Sheet | ❌ needs a column | direct | none | alt (most robust parse) |
| PDF highlight *annotation* | ✅ | indirect (quadpoints→text) | none | fallback |
| PDF yellow *fill* (original) | ✅ | indirect, fragile | **required** | last resort |

**Decision:** build around **DOCX**. Optionally keep a PDF-yellow-fill path later as a last resort; not needed now.

---

## DOCX parsing (validated)

Reference implementation: `scripts/docx_extract_tc.py` (proven on `rivlin_transcript_selected_syncs.docx`).

1. A `.docx` is a ZIP → read `word/document.xml`. (In-panel: bundle a tiny unzip lib, e.g. **`fflate`** ~30 KB.)
2. Walk the table `w:tbl / w:tr / w:tc`.
3. Per row: if a cell's text matches `^\d{2}:\d{2}:\d{2}:\d{2}$`, that's the row's `tc`; **carry it forward** to following rows that lack one.
4. A run is "highlighted" if its `w:rPr` has `w:highlight="yellow"` **or** `w:shd w:fill` in the yellow set.
5. Per `tc` block: `hl = any highlighted run`; `comment = first 5 words of the concatenated highlighted text`.
6. Output rows `[{tc, hl, comment}]` in document order.

> Edge case: a highlight spanning two rows that each carry their own `tc` yields a marker at **each** of those timecodes. Usually desired for syncs; flag if you'd rather collapse to one per contiguous highlight.

---

## Marker behavior (validated)

Reference core: `scripts/drop_docx_markers.js`.

- **Highlighted-only:** mark **only** the highlighted syncs; non-highlighted `tc` rows are ignored. (A "mark all timecodes" mode can be added later as an option, but is off by design.)
- **Position:** `pos = tc2sec(tc) − sequence.zeroPoint`. Clamp `<0`→0; **skip** `> endTime`. `tc2sec` at 25 fps (the DOCX/PDF tc base).
- **Dedupe** by frame (`round(pos*fps)`); on collision keep one marker + its comment (Premiere forbids two markers on one frame).
- **Add** one comment-type marker per highlighted sync, carrying the 5-word comment.
- **Recolor** every added marker to **red (index 1)** in a follow-up transaction.
- **Existing markers:** default **clear-first** (idempotent re-runs), with an **append/merge** option (skip occupied frames).

### Validated marker color API (PPro 2026 UXP)
- `markers = await ppro.Markers.getMarkers(seq)`
- `markers.createAddMarkerAction(name, type, startTickTime, durTickTime, comment)` — 5th arg comment works.
- `marker.createSetColorByIndexAction(index)` — inside `executeTransaction`.
- `marker.getStart()` / `getColorIndex()` / `getColor()` → `{red,green,blue}` 0–1.
- All mutations: `project.lockedAccess(() => project.executeTransaction(tx => tx.addAction(action), "label"))`.

### Validated color-index map
| idx | color | | idx | color |
|---|---|---|---|---|
| 0 | olive-green (**default**) | | 4 | yellow/gold |
| 1 | **red** (highlighted) | | 5 | white |
| 2 | mauve/purple | | 6 | blue |
| 3 | orange | | 7 | cyan |

---

## Architecture (independent, no bridge)

Standalone UXP plugin. The `premiere-bridge` eval panel was used only to *discover/validate* the APIs this session — the shipped tool reimplements the logic in-panel and has **no** dependency on it.

```
tc-marker-tool/
  manifest.json        # id tv.promots.tc-markers; panel entrypoint; localFileSystem fullAccess
  index.html           # UI
  index.js             # UI + DOCX parse + marker apply (in-panel)
  lib/fflate.min.js    # bundled unzip (DOCX = ZIP)
  docxParse.js         # extract [{tc,hl,comment}] from word/document.xml
  markers.js           # applyMarkers() — from scripts/drop_docx_markers.js
  icons/
```

**Flow:** Load `.docx` → `fflate` unzip → parse `document.xml` → `[{tc,hl,comment}]` → read live `zeroPoint`/`endTime` → add markers → recolor + comment highlighted → report.

> UXP XML parsing: prefer DOMParser if available in the UXP build; otherwise a small namespaced walk (as in `docx_extract_tc.py`) over the inflated XML string.

---

## UI (single panel)

- Header: active sequence name · zeroPoint TC · fps (refreshable).
- **Load DOCX** → shows: total `tc` rows, highlighted count, range (first→last), out-of-range count.
- Options: highlighted-marker color (default **red**), comment word-count (default **5**), clear-first vs append/merge, fps (default 25).
- **Apply markers** → result summary (added / colored / skipped) + log.

---

## Deployment to multiple Premiere machines

The tool must install cleanly on many editors' machines. Options, simplest → most "productized":

1. **UXP Developer Tool (UDT) load** — per machine, "Add Plugin" → select folder → Load. Fine for a few machines / iteration; **unsigned, dev-only**, must re-load.
2. **Packaged `.ccx` + UPIA install** — package the plugin (UDT can package), then install per machine with the **UnifiedPluginInstallerAgent (UPIA)** CLI. No marketplace, scriptable for fleet rollout. **Likely the right path for internal deployment.**
3. **Private Adobe Exchange listing** — Adobe signs/hosts; editors install via Creative Cloud. Most turnkey for end users but requires a submission/signing flow.

**Open item:** confirm signing requirements for option 2 on PPro 2026 (UXP plugins generally need signing for non-UDT install). Decide UDT-for-now vs packaged-`.ccx` for the rollout. Manifest needs a stable `id`, `version`, and proper icons before packaging.

---

## Validated this session (2026-06-14)

Proven against `transcript_selected_texts/rivlin_transcript_selected_syncs.docx` → sequence **"Rubi Rivlin_camA_markers"** (zeroPoint 37757.08 s, end 8074.24 s):

- DOCX: **3,093** `w:highlight="yellow"` runs · **222** table rows · **216** distinct `tc` · **44** highlighted.
- Final behavior (highlighted-only): dropped **44** markers, all **red (1)** with first-5-words comments; 0 skipped, 0 dupes.
- Verified by reading back: 44 markers, all colorIndex 1, comments present, timecodes frame-accurate. (Interim full-216 run was cleared.)
- Marker color API + index map discovered and confirmed (above).

Artifacts kept in repo: `scripts/docx_extract_tc.py`, `scripts/drop_docx_markers.js`.

---

## Validation plan (for the panel build)

1. Bundle `fflate` + port `docx_extract_tc.py` logic to in-panel JS; confirm it reproduces 216 tc / 44 highlighted from the rivlin DOCX.
2. Wire parser → `markers.js`; re-run on "Rubi Rivlin_camA_markers" and reproduce the 216/44 result with red + comments.
3. Test a Google-Docs-exported DOCX (`w:shd` fill path).
4. Package and test install on a second machine (option 2).

---

## Reference

- Validated scripts: `scripts/docx_extract_tc.py`, `scripts/drop_docx_markers.js`
- Earlier hardcoded-list version: `scripts/drop_tc_markers.js`
- API discovery panel (dev only): `premiere-bridge/`
- Memory: `reference_ppro_uxp.md` (marker + color API), `project_premiere_bridge.md`
