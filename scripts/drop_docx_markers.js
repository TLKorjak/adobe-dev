// drop_docx_markers.js — VALIDATED session logic (PPro 2026 UXP).
//
// Drops a sequence marker for each HIGHLIGHTED sync only: red (color 1) +
// a comment (first 5 words of the highlighted text). Non-highlighted
// timecodes are ignored. Validated on "Rubi Rivlin_camA_markers": 44 markers.
//
// ROWS is injected as [{tc:"HH:MM:SS:FF", hl:bool, comment:string}, ...]
// (produced by scripts/docx_extract_tc.py). In the final dockable tool this
// logic is reimplemented in-panel — no bridge / no injected data.
//
// Marker color indices (validated via getColor):
//   0 olive-green (default) · 1 red · 2 mauve · 3 orange · 4 yellow ·
//   5 white · 6 blue · 7 cyan
//
// Validated marker API:
//   markers = await ppro.Markers.getMarkers(seq)
//   markers.createAddMarkerAction(name, type, startTickTime, durTickTime, comment)
//   marker.createSetColorByIndexAction(index)   // inside a transaction
//   marker.getStart()/getColorIndex()/getColor()
//   project.lockedAccess(() => project.executeTransaction(tx => ..., "label"))

const ROWS = [];           // injected
const HL_COLOR = 1;        // red
const FPS = 25;            // PDF/DOCX tc base

const seq = await h.getSequence();
const project = await h.getProject();
const markers = await ppro.Markers.getMarkers(seq);
const T = ppro.Marker.MARKER_TYPE_COMMENT;
const z = ppro.TickTime.TIME_ZERO;
const zero = (await seq.getZeroPoint()).seconds;
const endS = (await seq.getEndTime()).seconds;
function tc2sec(tc){ const p = tc.split(":"); return (+p[0])*3600 + (+p[1])*60 + (+p[2]) + (+p[3])/FPS; }

// highlighted syncs only
const HL = ROWS.filter(r => r.hl);

// clear existing (idempotent; the tool offers append/merge too)
const existing = await markers.getMarkers();
const cleared = existing.length;
if (cleared) await project.lockedAccess(() => project.executeTransaction(tx => {
  for (const m of existing) tx.addAction(markers.createRemoveMarkerAction(m));
}, "clear"));

// build deduped items (position = absolute tc - sequence zeroPoint)
const seen = {}; const items = []; let skipRange = 0, skipDup = 0;
for (const r of HL){
  let pos = tc2sec(r.tc) - zero;
  if (pos < 0) pos = 0;
  if (pos > endS){ skipRange++; continue; }
  const key = Math.round(pos * FPS);
  if (seen[key] !== undefined){ const it = items[seen[key]]; if (!it.comment) it.comment = r.comment; skipDup++; continue; }
  seen[key] = items.length;
  items.push({ pos, name: r.tc, comment: r.comment || "" });
}

// add markers (each with its comment)
let added = 0;
await project.lockedAccess(() => project.executeTransaction(tx => {
  for (const it of items){
    tx.addAction(markers.createAddMarkerAction(it.name, T, ppro.TickTime.createWithSeconds(it.pos), z, it.comment));
    added++;
  }
}, "add highlighted markers"));

// recolor all added markers red
const arr = await markers.getMarkers();
let colored = 0;
await project.lockedAccess(() => project.executeTransaction(tx => {
  for (const m of arr){ tx.addAction(m.createSetColorByIndexAction(HL_COLOR)); colored++; }
}, "color red"));

const after = await markers.getMarkers();
return { sequence: seq.name, highlightedRows: HL.length,
  cleared, skippedOutOfRange: skipRange, skippedDuplicateFrame: skipDup,
  markersAdded: added, coloredRed: colored, markersNow: after.length };
