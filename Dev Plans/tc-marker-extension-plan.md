# TC Marker Tool — Premiere Dockable Extension Plan

**Status:** Planned (not built)
**Date:** 2026-06-10
**Goal:** Package the `drop_tc_markers.js` workflow into a self-contained, dockable Premiere Pro 2026 panel that loads a transcript PDF, extracts the timecodes from its `tc` column, and applies sequence markers to the active timeline — with buttons, no terminal / `send.sh` / eval.

---

## Terminology: "extension" vs "plugin"

In Premiere Pro 2026 these are effectively the same thing:

- A dockable panel **is** a **UXP plugin with a `panel` entrypoint**. Once loaded it appears under the Window menu and docks like any native panel. "UXP plugin" is just the package name; the dockable thing the user sees *is* the extension. (`premiere-bridge` already docks this way today.)
- The older thing literally called an **"Extension" (CEP / ZXP)** is **legacy and deprecated** — Adobe is removing CEP from Premiere. CEP panels on PPro 2026 are unsupported/flaky and would lose the modern file/network APIs we rely on.

**Decision:** build a standalone UXP plugin = standalone dockable extension. This is the supported equivalent of a CEP extension, already proven to work in this exact PPro 2026 + UXP setup. No upside to CEP, real downside (deprecation, weaker file I/O).

---

## Source PDF format (grounds the parser)

Based on `איילה_חסון_מאוחד.pdf` — assume future PDFs match this layout.

A multi-page table, three columns: a tiny empty `src_id`, a middle `tc` column, and `מלל` (transcript text) on the right.

- **The `tc` column** holds `HH:MM:SS:FF` values (e.g. `16:36:13:00`). Only rows that start a new timecode have one; most text rows have an empty `tc` cell.
- **Every real `tc` value ends in `:00` frames** in this file (whole-second granularity) — a useful secondary signal, but not relied upon.
- **Divider rows that must be EXCLUDED** (these tripped us up in the manual pass):
  - `TC 00:36:41:00` — reel/offset divider (note: ends in `:00`, so frame value alone can't filter it).
  - `TC 17:51:09:09` — section divider.
  - `סוף קלטת 18:22:30:23 TC` and `סוף קלטת 19:30:32:27 TC` — "end of tape" rows.
- **No spurious `HH:MM:SS:FF` strings appear in dialogue.** People say years (`48'`, `2023`), `16:8`, etc. — never a full 4-field timecode. So the regex `\d{2}:\d{2}:\d{2}:\d{2}` is highly specific.

**Extraction rule:** grab every `\d{2}:\d{2}:\d{2}:\d{2}` token, then drop any whose adjacent text is the literal `TC` or `סוף קלטת`. That cleanly separates the ~334 real markers from the 4 dividers — no hand-curated list. This is the `drop_tc_markers.js` logic, automated.

> Note: the PDF is "Part 1". A separate part/cam likely covers the tail timecodes (`18:42:27` → `18:58:00`) that fell past this clip's end. One PDF → one sequence.

---

## The real technical risk: parsing a PDF inside UXP

UXP has no built-in PDF reader. The only self-contained option is to **bundle a JS PDF library (`pdfjs-dist` legacy build)** and call `getDocument({data})` → `getTextContent()` per page. We need *text only*, not rendering, so the usual pdf.js-in-UXP pain points (canvas, fonts, eval) are mostly avoided; the manifest already grants `allowCodeGenerationFromStrings`.

**This must be spiked and proven first** (go/no-go gate). Fallback if it fails: run the parse step out-of-process once and have the panel do all the Premiere work — only if the spike fails.

---

## Architecture

A **new, standalone dockable panel**, separate from `premiere-bridge` (which is a dev/eval tool). Reuses the validated marker-transaction code verbatim.

```
tc-marker-tool/
  manifest.json        # id tv.promots.tc-markers; panel entrypoint; localFileSystem fullAccess
  index.html           # UI
  index.js             # UI logic + marker apply (reused transaction pattern)
  lib/pdf.min.js       # bundled pdf.js (legacy)
  lib/pdf.worker.min.js
  pdfParse.js          # extractTimecodes(arrayBuffer) -> {timecodes, dividers, raw}
  markers.js           # applyTcMarkers(...) — lifted from drop_tc_markers.js
  icons/
```

### Parsing flow (`pdfParse.js`)
1. `uxp.storage.localFileSystem.getFileForOpening()` → `file.read({format: binary})` → ArrayBuffer.
2. pdf.js → concatenate text items across all pages.
3. Regex all timecodes; filter out `TC` / `סוף קלטת`-adjacent ones; dedupe; sort.
4. Return found list + excluded dividers + counts (nothing silently dropped).

### Marker flow (`markers.js`, logic unchanged from `drop_tc_markers.js`)
- Read live `zeroPoint` / `endTime` / `timebase`.
- `pos = tc2sec − zeroPoint`; clamp `<0` → 0, skip `> endSec`.
- Dedupe by frame; one `executeTransaction` via `lockedAccess`.
- Returns the same result object we've been verifying against.

---

## Decisions (confirmed with user)

| Topic | Decision |
|-------|----------|
| **Packaging** | Standalone UXP plugin = dockable panel `tv.promots.tc-markers` (this *is* the extension). |
| **Marker content** | Name = source timecode (e.g. `16:36:13:00`), empty comment. |
| **Existing markers** | **Append / merge** — keep existing, add new, skip any frame already occupied (Premiere forbids two markers on one frame). Re-running won't duplicate. Plus an optional "Clear all first" checkbox, defaulted **off**. |
| **fps** | Auto from sequence timebase, default 25. |

---

## UI (single panel)

- Active sequence name · zeroPoint TC · detected fps (top, with refresh).
- **Load PDF** → shows: timecodes found, range (first→last), dividers excluded, out-of-range count.
- Options: fps (auto, default 25), clear-existing toggle (default off), marker color/type.
- **Apply markers** → result summary + log.

---

## Validation plan

1. **Spike** pdf.js text extraction in UXP against this exact PDF → confirm we recover all 334 timecodes and isolate the 4 dividers separately. **(go/no-go gate)**
2. Wire parser → marker apply; re-run against "Ayala Hason_260526_01_camA" and confirm it reproduces the verified **308-placed / 26-out-of-range** result.
3. Test on the Rubi PDF (different file) to confirm generality.
4. **Fallback** if pdf.js won't cooperate in UXP: ship the parser as a tiny out-of-process step (parse once externally, plugin still does all Premiere work) — only if the spike fails.

---

## Reference

- Reused logic source: `scripts/drop_tc_markers.js`
- Existing UXP panel for reference: `premiere-bridge/` (manifest, IPC, marker transaction pattern)
- Marker API notes: memory `reference_ppro_uxp.md`, `project_premiere_bridge.md`
- Validated marker pattern: `await ppro.Markers.getMarkers(seq)` → `createAddMarkerAction(name, type, tickTime, dur, comment)` → `project.lockedAccess(() => project.executeTransaction(tx => tx.addAction(action), label))`.
