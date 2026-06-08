# Premiere Bridge

A general-purpose **UXP automation bridge for Adobe Premiere Pro 2026**. It exposes the full Premiere UXP API (`premierepro`) to an outside process (a terminal / chat session) over a simple file-based IPC channel, so Premiere can be driven programmatically from scripts.

## Why this exists

Premiere Pro 2026 **removed the legacy AppleScript `DoScriptFile` ExtendScript bridge** (its scripting dictionary now lists only `capture` and `editoriginal`; any `doscriptfile` call returns *"Message not understood"*). UXP is the only remaining automation channel. This plugin is that channel — a thin, generic panel that accepts commands on disk and runs them against the live UXP API.

## Architecture

```
caller (send.sh / any process)                Premiere Bridge panel (index.js)
        │  writes cmd.json  ─────────────────▶  polls data folder every 400ms
        │                                       reads + claims (deletes) cmd.json
        │                                       runs it against the UXP API
        ◀──── reads result.json ──────────────  writes result.json
```

- The IPC channel is the plugin's own UXP **data folder** (a real path on disk both sides can read/write).
- On this machine that is:
  `~/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO/26/Developer/tv.promots.premiere-bridge/PluginData/`
- The panel logs its actual data-folder path on boot — if it differs, update `DATA_DIR` in `send.sh`.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Plugin id `tv.promots.premiere-bridge`, PPro 25.6+. Note `requiredPermissions.allowCodeGenerationFromStrings: true` — **required** for the `eval` command. |
| `index.js` | IPC poll loop + command dispatch + helpers. |
| `index.html` | Panel UI: status dot, live IPC path, Ping / Active state / Copy log / Clear log buttons. |
| `send.sh` | Chat-/terminal-side sender. |
| `icons/` | Panel icons (UDT requires at least one). |

## Loading the plugin

1. Open **UXP Developer Tool** (UDT).
2. **Add Plugin** → select `premiere-bridge/manifest.json`.
3. **Load** (or **Load & Watch** for hot-reload on file save).
4. In Premiere: Developer Mode on (Settings → Plugins), then **Window → Premiere Bridge**.
5. The panel must read **"listening"** before sending commands.

## Sending commands

```bash
./send.sh '{"cmd":"ping"}'          # inline JSON
./send.sh --eval path/to/code.js    # wrap a JS file as {cmd:"eval",code:...}  (no escaping)
./send.sh --json path/to/cmd.json   # raw JSON command file
```

`send.sh` writes the command atomically (`mv`), clears the old result, then polls up to 60s for `result.json` and prints it.

## Commands

### Core / discovery
| Command | Description |
|---------|-------------|
| `{cmd:"ping"}` | Sanity check; returns the data-folder path. |
| `{cmd:"activeState"}` | Active project + sequence name, video/audio track counts. |
| `{cmd:"dumpSequence"}` | All video tracks → clips → project-item names (names only; safe). |
| `{cmd:"describeClip", track, clip}` | One clip's components + param display names. |
| `{cmd:"introspect", target}` | List member names+kinds of `ppro` \| `uxp` \| `project` \| `sequence` \| `firstClip` \| `path` (a dotted path off ppro/sequence/project). Reads **names only**, so it never triggers the value-proxy crashes. Use it to discover the live API. |

### Markers
| Command | Description |
|---------|-------------|
| `{cmd:"listMarkers"}` | All sequence markers: name, comment, start seconds. |
| `{cmd:"addMarker", seconds, name, comment}` | Add one marker. |
| `{cmd:"addMarkers", markers:[{seconds,name,comment}], clearExisting?, mergeSameTime?}` | Batch add. `mergeSameTime` (default **true**) merges entries on the same frame into one marker — **required** because Premiere forbids two sequence markers on the same frame. `clearExisting` wipes markers first. |
| `{cmd:"clearMarkers"}` | Remove all sequence markers. |

### `eval` — the universal command
```json
{ "cmd": "eval", "code": "<async JS body>" }
```
Runs an async JS body with these in scope and returns its value (safely serialized):

- `ppro` — `require('premierepro')`
- `uxp` — `require('uxp')`
- `h` — helpers: `{ ppro, uxp, log, memberNames, getProject, getSequence, getVideoTrackCount, getClip }`

This single command can perform **any** task the UXP API supports. Promote frequently-used logic into a named command (above) once it's stable; until then, `eval` covers it with no plugin reload.

Example (`code.js`, sent with `./send.sh --eval code.js`):
```js
const seq = await h.getSequence();
const t = await seq.getCaptionTrack(0);
const items = await t.getTrackItems(1, false);
const first = await items[0].getStartTime();
return { captions: items.length, firstStartSec: first.seconds };
```

## Validated UXP patterns (PPro 2026 / 26.2.2)

- **Mutations** go through: `project.lockedAccess(() => project.executeTransaction(tx => tx.addAction(action), "label"))`. Action-creators (`createAddMarkerAction`, etc.) fail outside a transaction. The `executeTransaction` callback is **synchronous** — do all `await` reads *before* it, then create + add actions inside.
- **Markers:** `const m = await ppro.Markers.getMarkers(sequence)` (must await; the sequence has no `getMarkers`, and the projectItem returns null). `createAddMarkerAction(name, type, startTickTime, durTickTime, comment)`; type = `ppro.Marker.MARKER_TYPE_COMMENT`.
- **TickTime:** `ppro.TickTime.createWithSeconds(s)` / `createWithTicks` / `createWithFrameAndFrameRate`; constants `TIME_ZERO`, etc. Reading `.seconds` / `.ticks` is fine on plain TickTime objects.
- **Playhead:** `await sequence.setPlayerPosition(tickTime)`.

## Known limitation

- **Caption text is not readable via UXP 2026.** Caption tracks/items are reachable (`sequence.getCaptionTrackCount()` / `getCaptionTrack(i)` / `track.getTrackItems(1,false)`) and you can read each caption's **in/out time**, but the **text** is not exposed — `getName()`/`getMatchName()` return only `"SyntheticCaption"`, caption items have no components, and `Transcript.exportToJSON` is a writer-style API (rejects existing timeline objects). Work around by matching captions **by timecode** and moving the playhead.

## Reloading

- `eval`-based work: **never** needs a reload.
- New named commands added to `index.js`: auto-applied with **Load & Watch**, otherwise **Reload** in UDT.
- `manifest.json` changes (permissions, id): require a full reload / re-add.
- Reloading is harmless — it only restarts the panel's IPC poll loop; project data is untouched.

## History

First production use (2026-06-08): placed 114 transcript markers on *Rubi Rivlin_250526_Cam A_transcript* from `rubi_marked_text_mapping.pdf` (125 matched rows → 114 markers after merging same-timecode rows; 6 "not found" rows skipped).
