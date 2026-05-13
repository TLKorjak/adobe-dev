# Plan: Automated AE Render Pipeline (Sheet-Driven)

## Architecture
```
Google Sheet  →  generator  →  jobs/*.json  →  runner.jsx (via aerender)  →  out/*.mov
   (humans)      (translator)   (queue)         (AE mutation + render)        ↑
       ↑                                                                      │
       └────────────── status column updated when done ──────────────────────┘
```
Three layers, each replaceable independently. Sheet = human interface, JSON = machine interface, ExtendScript = AE interface.

## 1. Template Setup (one-time, in AE)
- Open the comp, rename the swap-target footage layer to `CLIP_SLOT`.
- Rename each text layer to a stable ID: `TXT_TITLE`, `TXT_SUBTITLE`, `TXT_CTA`, etc.
- Pre-trim/position `CLIP_SLOT` so in-point and 8s duration are locked — new clips inherit placement via `replaceSource`.
- Save as `template.aep`.

## 2. Google Sheet (human interface)
One row per render job. Columns map 1:1 to manifest fields:

| clip_path | txt_title | txt_subtitle | txt_cta | output_path | status |
|---|---|---|---|---|---|
| /footage/a.mov | Hello | World | Buy now | /out/a.mov | pending |
| /footage/b.mov | Bonjour | Monde | Achetez | /out/b.mov | pending |

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
     "clip": "<clip_path>",
     "text": { "TXT_TITLE": "<txt_title>", "TXT_SUBTITLE": "<txt_subtitle>", "TXT_CTA": "<txt_cta>" },
     "output": "<output_path>"
   }
   ```
4. Update sheet cell `status = queued` for each emitted row.
5. Validate paths exist (clip readable, output dir writable) before queuing; bad rows → `status = error` + `error_msg`.

Runs on a cron, file-watcher, or manual trigger — your choice.

## 4. Runner Script (ExtendScript, `runner.jsx`)
Reads the manifest path from an env var or sidecar file, then:
1. `app.open(File("template.aep"))`
2. Import the new clip: `app.project.importFile(new ImportOptions(File(job.clip)))`
3. Find `CLIP_SLOT` in the comp → `replaceSource(newFootage, false)` (preserves in-point, scale, transforms).
4. For each text key, find layer by name, `property("Source Text").setValue(textDocument)` — use a `TextDocument` so styling is preserved.
5. Add comp to render queue, set Output Module template, `outputModule.file = new File(job.output)`.
6. `app.project.renderQueue.render()` (blocking) — or invoke via `aerender` for headless.
7. Remove the imported footage item to avoid project bloat; do NOT save the template.
8. Write a small `<output>.status.json` sidecar with `{ row_id, status, error }` for the batch layer to pick up.

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
- Missing layer name in comp → fail fast, write to `error_msg`, skip job.
- Clip shorter than 8s → log warning; decide policy (stretch / letterbox / error).
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
