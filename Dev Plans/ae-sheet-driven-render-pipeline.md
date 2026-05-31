# Plan: Automated AE Render Pipeline (Sheet-Driven)

## Architecture
```
Google Sheet  →  generator  →  jobs/*.json  →  runner.jsx (via aerender)  →  out/*.mov
   (humans)      (translator)   (queue)         (AE mutation + render)        ↑
       ↑                                                                      │
       └────────────── status column updated when done ──────────────────────┘
```
Three layers, each replaceable independently. Sheet = human interface, JSON = machine interface, ExtendScript = AE interface.

## Dynamic Elements (what changes per render)
- **Comp:** fixed `1920 x 1080`, fixed duration.
- **Video slots:** 1 or 2 clips per job. Each clip has a fixed duration and fixed timeline placement.
- **Text layers:** 2–4 text fields per job, each addressed by a stable layer name.
- **Logo slots:** 2 PNG logos per job, fixed placement on the timeline.
- **Media dimensions:** all clips and logos are expected to match comp (1920×1080). If they don't, the runner applies **fit-to-fill** (scale so the asset covers the full 1920×1080 frame, center-anchored, crop overflow — no letterboxing, no distortion).

## 1. Template Setup (one-time, in AE)
- Open the comp (`1920x1080`, fixed duration).
- Rename the swap-target footage layers to stable IDs:
  - `CLIP_SLOT_1`, `CLIP_SLOT_2` — video. Slot 2 is optional per job; leave it in the template but the runner disables it (`layer.enabled = false`) when the manifest only provides one clip.
  - `LOGO_SLOT_1`, `LOGO_SLOT_2` — PNG.
- Pre-trim/position each slot so in-point and duration are locked. New media inherits placement via `replaceSource`.
- Rename each text layer to a stable ID: `TXT_1`, `TXT_2`, `TXT_3`, `TXT_4` (or semantic: `TXT_TITLE`, `TXT_SUBTITLE`, …). Up to 4 expected; runner ignores keys not present in the manifest and leaves unused template layers at their default text.
- Save as `template.aep`.

### Fit-to-fill logic (runner-side, applied to every media swap — both `CLIP_SLOT_*` and `LOGO_SLOT_*`)
For each swapped media layer, after `replaceSource`:
1. Read incoming asset `width` / `height` from the imported `FootageItem`.
2. If both match `1920` and `1080` → leave scale at 100%.
3. Otherwise compute `scale = max(1920 / width, 1080 / height) * 100` and set the layer's `Scale` property to `[scale, scale]`. Anchor point and position stay at comp center so the asset covers the frame; overflow is cropped by the comp bounds.
4. Force the imported footage's `pixelAspect = 1.0` to avoid non-square-pixel surprises.

Logos and clips use the same logic — PNGs that are already 1920×1080 with their own transparency/composition baked in will pass through untouched; off-spec PNGs will scale-to-cover. If a logo is supposed to sit small in a corner rather than fill frame, it should be 1920×1080 with transparent padding around it (so fit-to-fill is a no-op).

## 2. Google Sheet (human interface)
One row per render job. Columns map 1:1 to manifest fields:

| clip_1 | clip_2 | logo_1 | logo_2 | txt_1 | txt_2 | txt_3 | txt_4 | output_path | status |
|---|---|---|---|---|---|---|---|---|---|
| /footage/a1.mov | /footage/a2.mov | /logos/brand.png | /logos/sponsor.png | Hello | World | Buy now | | /out/a.mov | pending |
| /footage/b1.mov |  | /logos/brand.png | /logos/sponsor.png | Bonjour | Monde |  |  | /out/b.mov | pending |

- `clip_2` blank → runner disables `CLIP_SLOT_2`.
- `txt_3` / `txt_4` blank → those template text layers keep their default content (or are blanked, per config).
- Both logo columns are required; blank logos → row marked `error`.

Sheet hygiene:
- `status` column values: `pending` / `queued` / `rendering` / `done` / `error`.
- Data validation on `status` (dropdown) to prevent typos.
- Optional `error_msg` column for failure details written back from the runner.
- Share the sheet read/write with the service account doing the polling.

**Access options** (pick one):
- **Google Sheets API + service account** — full read/write, status round-trips back. Best for production.
- **Published-to-web CSV link** — read-only, zero auth, simplest. Status stays manual.
- **Local `jobs.csv`** — no Google at all, version-controllable. Good for solo workflows.

## 3. Generator Script (translator)
A ~50-line Node or Python script (`generate.js`):
1. Auth to Google Sheets via service account JSON key.
2. Read the rows; filter to `status = pending`.
3. For each row, write `jobs/<row-id>.json`:
   ```json
   {
     "row_id": 7,
     "clips": {
       "CLIP_SLOT_1": "/footage/a1.mov",
       "CLIP_SLOT_2": "/footage/a2.mov"
     },
     "logos": {
       "LOGO_SLOT_1": "/logos/brand.png",
       "LOGO_SLOT_2": "/logos/sponsor.png"
     },
     "text": {
       "TXT_1": "Hello",
       "TXT_2": "World",
       "TXT_3": "Buy now"
     },
     "output": "/out/a.mov"
   }
   ```
   Omit keys for blank cells — runner treats missing keys as "leave template default" for text, "disable layer" for `CLIP_SLOT_2`.
4. Update sheet cell `status = queued` for each emitted row.
5. Validate paths exist (clip readable, output dir writable) before queuing; bad rows → `status = error` + `error_msg`.

Runs on a cron, file-watcher, or manual trigger — your choice.

## 4. Runner Script (ExtendScript, `runner.jsx`)
Reads the manifest path from an env var or sidecar file, then:
1. `app.open(File("template.aep"))`.
2. For each entry in `job.clips` and `job.logos`:
   - Import via `app.project.importFile(new ImportOptions(File(path)))`.
   - Find the named layer (`CLIP_SLOT_1`, `CLIP_SLOT_2`, `LOGO_SLOT_1`, `LOGO_SLOT_2`) in the comp.
   - `layer.replaceSource(newFootage, false)` (preserves in-point and existing transforms).
   - Apply fit-to-fill scale (see §1) based on incoming `width`/`height`.
3. If `CLIP_SLOT_2` is not in `job.clips`, set its layer `enabled = false` so it doesn't render.
4. For each key in `job.text`: find layer by name, build a `TextDocument` from the existing source (to preserve font/size/color/styling), set `.text = value`, then `property("Source Text").setValue(textDoc)`. Missing keys → leave template default.
5. Add comp to render queue, set Output Module template, `outputModule.file = new File(job.output)`.
6. `app.project.renderQueue.render()` (blocking) — or invoke via `aerender` for headless.
7. Remove the imported footage items to avoid project bloat; do NOT save the template.
8. Write a `<output>.status.json` sidecar with `{ row_id, status, error }` for the batch layer to pick up.

Wrap in `app.beginUndoGroup` / `endUndoGroup` so a manual run is reversible.

## 5. Batch Layer (shell)
A small bash/Node loop:
- Reads each `jobs/*.json`.
- For each: update sheet `status = rendering`, invoke `aerender -project template.aep -script runner.jsx -comp "Main"` (manifest path passed via env var).
- On exit, read the sidecar status file → update sheet `status = done` or `error` + `error_msg`.
- Move the consumed JSON to `jobs/done/` or `jobs/failed/`.

`aerender` is headless and avoids stealing focus on your workstation. Parallelize across machines by sharding the queue if needed.

## 6. Status Round-Trip
The full lifecycle of one row:
```
pending   →  generator emits JSON  →  queued
queued    →  batch loop picks up   →  rendering
rendering →  aerender exits 0      →  done
rendering →  aerender exits != 0   →  error  (+ error_msg)
```
This makes the sheet the single source of truth for "what's left to do" — anyone can glance at it and know the state.

## 7. Validation & Failure Modes
- Missing layer name in comp (e.g. `LOGO_SLOT_2` deleted from template) → fail fast, write to `error_msg`, skip job.
- Missing required asset (any clip in `job.clips`, both logos) → row → `error`.
- Clip duration shorter than slot duration → log warning; decide policy (freeze-frame end / error). Default: error.
- Logo PNG without alpha channel → log warning; render proceeds (will show as opaque rectangle).
- Off-spec dimensions on any asset → fit-to-fill applied silently; logged for review.
- Font missing → AE silently substitutes; pre-flight via `textDocument.fontLocation`.
- Output path exists → overwrite / version-suffix / error (configurable).
- Sheet unreachable → generator/batch logs locally and retries; never crashes the runner.
- macOS path > 1002 chars crashes AE — validate path length in the generator.

## 8. Optional Niceties
- `--dry-run` mode: swap, save one preview frame, skip full render.
- Trigger generator from a Sheet `onEdit` Apps Script — change `pending` and the job appears in the queue within seconds.
- Slack/email webhook on `error` rows.
- Second sheet tab as an audit log (append-only history of every render).

## Why this shape
ExtendScript handles AE-side mutation because only ExtendScript can touch the DOM. The spreadsheet handles human input because that's what spreadsheets are for. JSON manifests are the durable contract between them — if you swap Sheets for Airtable, or `aerender` for Nexrender, only one layer changes. Each render is a fresh open → mutate → render → discard cycle, which is the only reliable way to avoid state bleed between jobs.