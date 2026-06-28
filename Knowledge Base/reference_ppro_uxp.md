---
name: Premiere Pro UXP Plugin API Reference
description: Comprehensive reference for Adobe Premiere Pro UXP plugin development — modern ES6+ replacement for ExtendScript/CEP, plugin structure, full API surface, action pattern, UI framework
type: reference
originSessionId: 7f417d52-030b-4e51-8e03-500933c11ebf
---
Source: https://developer.adobe.com/premiere-pro/uxp/

## What is UXP

UXP (Unified Extensibility Platform) is Adobe's modern JS-based extensibility platform replacing both ExtendScript and CEP. Uses standard web technologies — JavaScript (ES6+), HTML, CSS.

**Key differences from ExtendScript:**
- ES6+ (let, const, arrow functions, async/await, classes, modules, Promises)
- Asynchronous method calls (don't block PPro UI)
- HTML/CSS UI instead of ScriptUI
- Access host API directly via `require('premierepro')` — no evalScript bridge

**Key differences from CEP:**
- Lightweight platform (not a full Chromium browser)
- No CSInterface needed
- More secure with explicit permission declarations
- Direct host API access

## Supported Versions

| PPro Version | UXP Status |
|---|---|
| 25.2.0 (Dec 2024) | Initial Public Beta |
| 25.6.0 | Official Release (near feature parity with ExtendScript) |
| 26.2.0 | Latest — adds Hybrid Plugin support (C++ native via `.uxpaddon`) |

Requires UXP Developer Tool (UDT) v2.2+ and Developer Mode enabled in PPro settings.

## Plugin Structure

```
my-plugin/
  manifest.json     — Plugin configuration (required)
  index.html        — User interface
  index.js          — Logic
```

### manifest.json

```json
{
  "manifestVersion": 5,
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "host": { "app": "premierepro", "minVersion": "25.6" },
  "main": "index.html",
  "entrypoints": [
    { "type": "panel", "id": "mainPanel", "label": "My Plugin" }
  ],
  "requiredPermissions": {
    "localFileSystem": "fullAccess",
    "network": { "domains": "all" },
    "clipboard": "readAndWrite"
  },
  "icons": [
    { "width": 24, "height": 24, "path": "icons/icon-24.png", "scale": [1, 2], "theme": ["darkest", "dark", "light", "lightest", "all"], "species": ["chrome", "generic"] },
    { "width": 48, "height": 48, "path": "icons/icon-48.png", "scale": [1, 2], "theme": ["darkest", "dark", "light", "lightest", "all"], "species": ["chrome", "generic"] }
  ]
}
```

Entry types: `"command"` (one-shot) or `"panel"` (persistent UI).

**Required, not optional:** `icons` must contain at least one entry — UDT rejects load with "Expected atleast a single entry in the icons list". An empty array `"icons": []` fails. Provide PNGs (placeholder solid-color works for dev). Each entry needs `width`, `height`, `path`, `scale`, `theme`, `species`.

## API Access

```javascript
const app = require('premierepro');
```

## Action Pattern

Most mutations return Action objects. Compose into CompoundAction, execute via `project.executeTransaction()` for undo/redo support:

```javascript
const project = await app.Project.getActiveProject();
const action = someObject.createSomeAction(params);
const compound = new app.CompoundAction();
compound.addAction(action);
await project.executeTransaction(compound, "Description for undo");
```

## Core API Reference

### Application

| Method | Description |
|---|---|
| `app.version` | PPro version string |

### Project

| Method | Description |
|---|---|
| `Project.getActiveProject()` | Get active project |
| `Project.createProject(path)` | Create new project |
| `Project.openProject(path)` | Open existing project |
| `project.importFiles(paths[], suppressUI)` | Import media |
| `project.importAEComps(aepPath, compNames, targetBin)` | Import AE comps (Dynamic Link) |
| `project.createSequence(name, id)` | Create empty sequence |
| `project.createSequenceFromMedia(name, clipItems[])` | Create sequence from clips |
| `project.getActiveSequence()` | Get active sequence |
| `project.save()` / `project.saveAs(path)` | Save project |
| `project.closeProject()` | Close project |
| `project.executeTransaction(action, desc)` | Execute mutation with undo support |
| `project.lockedAccess(callback)` | Lock project for thread-safe access |

### Sequence

| Method | Description |
|---|---|
| `sequence.guid` | Unique ID |
| `sequence.name` | Name (read/write) |
| `sequence.getVideoTrack(idx)` | Get video track by index |
| `sequence.getAudioTrack(idx)` | Get audio track by index |
| `sequence.getCaptionTrack(idx)` | Get caption track |
| `sequence.getPlayerPosition()` | CTI position (TickTime) |
| `sequence.setPlayerPosition(tickTime)` | Set CTI |
| `sequence.getSelection()` | Selected track items |
| `sequence.setSelection(items[])` | Set selection |
| `sequence.getSettings()` | Sequence settings |
| `sequence.createSetSettingsAction(settings)` | Modify settings |

### VideoTrack / AudioTrack

| Method | Description |
|---|---|
| `track.name` / `track.id` | Info |
| `track.getIndex()` | Track index |
| `track.getTrackItems(type, includeEmpty)` | Get clips/transitions |
| `track.isMuted()` / `track.setMute(state)` | Mute control |

Events: `TRACK_CHANGED`, `INFO_CHANGED`, `LOCK_CHANGED`

### VideoClipTrackItem / AudioClipTrackItem

| Method | Description |
|---|---|
| `clip.start` / `clip.end` / `clip.duration` | Timing (TickTime) |
| `clip.inPoint` / `clip.outPoint` | Source in/out |
| `clip.createMoveAction(newTime)` | Move clip |
| `clip.name` / rename | Display name |
| `clip.disabled` | Enable/disable |
| `clip.getProjectItem()` | Back-reference to source |
| `clip.getComponentChain()` | Effects chain (Video/AudioComponentChain) |
| Add/remove transitions | Via transition actions |

### ProjectItem / ClipProjectItem / FolderItem

| Method | Description |
|---|---|
| `item.type` / `item.name` | Basic info |
| `item.getId()` | Unique ID |
| `item.getParentBin()` | Parent folder |
| `clipItem.getMediaPath()` | Source file path |
| `clipItem.changeMediaPath(newPath)` | Relink |
| `clipItem.attachProxy()` / `hasProxy()` | Proxy workflow |
| `clipItem.isOffline()` | Offline check |
| `folderItem.createBinAction(name)` | Create sub-bin |
| `folderItem.getItems()` | List children |
| `folderItem.createMoveItemAction(item)` | Move items |
| `folderItem.createRemoveItemAction(item)` | Remove items |

### Effects — Component / ComponentParam

| Method | Description |
|---|---|
| `component.getDisplayName()` | Localized name |
| `component.getMatchName()` | Internal identifier |
| `component.getParam(index)` | Get parameter |
| `component.getParamCount()` | Parameter count |
| `param.displayName` | Parameter name |
| `param.getValueAtTime(time)` | Read value at time |
| `param.getStartValue()` | Static value |
| `param.createSetValueAction(value, time)` | Set value (returns action) |
| `param.isTimeVarying()` | Has keyframes |
| Keyframe CRUD | Add/remove/modify keyframes |
| `param.interpolationMode` | Linear, Hold, Bezier |

### VideoComponentChain / AudioComponentChain

| Method | Description |
|---|---|
| `chain.createAppendComponentAction(component)` | Add effect at end |
| `chain.createInsertComponentAction(component, idx)` | Insert effect at position |
| `chain.createRemoveComponentAction(idx)` | Remove effect |
| `chain.getComponentAtIndex(idx)` | Get effect |
| `chain.getComponentCount()` | Effect count |

### VideoFilterFactory / AudioFilterFactory

| Method | Description |
|---|---|
| `VideoFilterFactory.createComponent(matchName)` | Create effect instance |
| `VideoFilterFactory.getDisplayNames()` | All available effect names |
| `VideoFilterFactory.getMatchNames()` | All available matchNames |

Match name format: `'AE.ADBE Mosaic'`, `'PR.ADBE Solarize'`

### TransitionFactory

| Method | Description |
|---|---|
| `TransitionFactory.createVideoTransition(matchName)` | Create transition |
| `TransitionFactory.getVideoTransitionMatchNames()` | Available transitions |

### Markers

| Method | Description |
|---|---|
| `Markers.getMarkers(seqOrItem)` | Get marker collection |
| `markers.getMarkers(typeFilter?)` | List markers |
| `markers.createAddMarkerAction(name, type, start, duration, comments)` | Add marker |
| `markers.createMoveMarkerAction(marker, newTime)` | Move marker |
| `markers.createRemoveMarkerAction(marker)` | Remove marker |

Marker types: Comment, Chapter, Segmentation, WebLink.
Marker colors: Green(0), Red(1), Purple(2), Orange(3), Yellow(4), White(5), Blue(6), Cyan(7)

### Exporter / EncoderManager

| Method | Description |
|---|---|
| `Exporter.exportSequenceFrame(seq, time, name, path, w, h)` | Export single frame (bmp/dpx/gif/jpg/exr/png/tga/tif) |
| `EncoderManager.getManager()` | Get AME manager |
| `mgr.encodeFile(path, preset, output)` | Encode file |
| `mgr.encodeProjectItem(item, preset, output)` | Encode project item |
| `mgr.exportSequence(seq, preset, output, exportType)` | Export full sequence |
| `mgr.isAMEInstalled` | Check AME availability |

Events: completion, error, cancel, queue, progress

### Metadata

| Method | Description |
|---|---|
| `Metadata.getProjectMetadata(item)` | PPro-private metadata |
| `Metadata.getXMPMetadata(item)` | XMP metadata |
| `Metadata.addPropertyToProjectMetadataSchema(name, label)` | Extend schema |

### SourceMonitor

| Method | Description |
|---|---|
| `sourceMonitor.play(speed)` | Play in source monitor |
| `sourceMonitor.getPosition()` | Current position |
| `sourceMonitor.openProjectItem(item)` | Open item |
| `sourceMonitor.openFilePath(path)` | Open file |
| `sourceMonitor.closeClip()` / `closeAllClips()` | Close |

### TickTime

Time representation in UXP (replaces mixed seconds/ticks of ExtendScript):
- `tickTime.seconds` — time in seconds
- `tickTime.ticks` — time in ticks (254016000000/sec)
- Arithmetic operations, frame alignment, comparison methods

### EventManager

```javascript
const em = app.EventManager;
em.addGlobalEventListener(app.ProjectEvent.PROJECT_CHANGED, callback);
em.addGlobalEventListener(app.SequenceEvent.ACTIVE_SEQUENCE_CHANGED, callback);
```

## UI Framework Options

1. **Standard HTML** — Full control, no auto-theming
2. **Spectrum UXP Widgets** (built-in) — `<sp-button>`, `<sp-textfield>`, etc. Auto-themed. May be deprecated.
3. **Spectrum Web Components (SWC)** (recommended) — Full component set. Requires npm, bundler, `enableSWCSupport: true`. Lock to **v0.37.0** for PPro compatibility.

React, Vue, Svelte supported. Modal dialogs via `<dialog>` element.

## Limitations

- UXP is NOT a browser — not all HTML/CSS/JS browser APIs available
- Keyboard shortcuts not functional in PPro yet
- Panel `hide()` / `destroy()` lifecycle hooks not fully functional
- Promise lifecycle hooks have 300ms timeout
- SWC must be locked to v0.37.0
- File paths >1002 chars on macOS can cause issues
- API surface still growing toward full parity with ExtendScript

## Crash-Inducing Patterns (verified the hard way)

UXP host objects (Component, ComponentParam, TickTime, value wrappers from `getStartValue()` etc.) are fragile proxies. The following patterns have crashed PPro 2026:

- **Awaiting `comp.getMatchName()` or `comp.getDisplayName()`** — verified hard-crash on the MOGRT-bearing clip in PPro 2026. Synchronous access (returns an unresolved Promise that JSON-stringifies as `{}`) is safe. Don't call these — identify components by index instead.
- Probing unknown wrappers with `in` operator: `if ('value' in v)` — triggers proxy traps that can hard-crash
- `Object.keys(hostObject)` on UXP wrappers
- Iterating over a list of candidate property names and accessing each with `v[k]` to "find" the payload
- Calling sync property accessors that are actually async (e.g. `tickTime.seconds` may be a getter returning a Promise — unawaited access can corrupt state)
- Calling `getStartValue()` / `getValueAtTime()` on every parameter in a deep dump loop — even if individual calls succeed, the cumulative load on certain param types crashes the host

Safe patterns:
- Only read primitives the docs document (e.g. `param.displayName` is a documented string property)
- Always `await` async methods; never access them as bare properties
- Don't introspect — if you need a value's shape, dump ONE param at a time after confirming the component is what you expect (via matchName)
- For TickTime, prefer documented arithmetic methods over reading raw `.seconds` / `.ticks` getters

**File IPC**: `require('fs')`'s `existsSync`/`readFileSync` is unreliable in UXP-PPro. Use `uxp.storage.localFileSystem.getDataFolder()` then `folder.getEntries()` / `entry.read()` / `folder.createEntry(name, {type, overwrite})` / `entry.write()` / `entry.delete()`. The data folder's `nativePath` gives you a real filesystem path other processes can read/write.

## Development Setup

1. Install UXP Developer Tool (UDT) v2.2+ via Creative Cloud
2. Enable Developer Mode: PPro Settings > Plugins > Enable developer mode (restart)
3. Create plugin from template in UDT: `premierepro-quick-starter`
4. "Load & Watch" in UDT for hot-reload development
5. Package as `.ccx` for distribution

TypeScript definitions (`types.d.ts`) available in the PPro reference docs.

## Validated on PPro 2026 / 26.2.2 (2026-06-08, via [[premiere-bridge-general-uxp-automation-tool]])

**Mutations = lockedAccess + executeTransaction + create*Action.** Action-creator methods (e.g. `createAddMarkerAction`) throw "Script action failed to execute" if called outside a transaction. Working shape:
```js
const project = await ppro.Project.getActiveProject();
project.lockedAccess(() => {
  project.executeTransaction((tx) => {
    const a = collection.createSomethingAction(...);
    tx.addAction(a);           // tx callback is SYNCHRONOUS — no await inside it
  }, "label");
});
```
Because the tx callback is sync, do all `await` reads (e.g. fetching objects/values to act on) BEFORE the transaction, then create+add actions inside it.

**Markers.** `const markers = await ppro.Markers.getMarkers(sequence)` (MUST await — sequence has NO getMarkers itself; markers are NOT on the projectItem → that returns null). Collection has `getMarkers()` (await → array), `createAddMarkerAction(name, type, startTickTime, durTickTime, comment)`, `createRemoveMarkerAction(markerObj)`, `createMoveMarkerAction`. Marker type const: `ppro.Marker.MARKER_TYPE_COMMENT`. Marker instance: `getName/getStart/getComments/getColor/getDuration` + `createSetNameAction/createSetColorByIndexAction/createSetCommentsAction`. **Premiere forbids two sequence markers on the same frame** — merge same-time entries into one marker.

**TickTime.** `ppro.TickTime.createWithSeconds(s)` / `createWithTicks` / `createWithFrameAndFrameRate`; constants `TIME_ZERO/TIME_ONE_SECOND/...`. Reading `.seconds` and `.ticks` as bare getters WORKED reliably here (the earlier "prefer arithmetic methods, don't read .seconds" caution was over-conservative for plain TickTime objects — it's the param VALUE-wrappers from getStartValue/getValueAtTime that crash, not TickTime).

**Safe introspection that does NOT crash:** enumerating member NAMES along the prototype chain (`Object.getOwnPropertyNames` while walking `getPrototypeOf`) on DOM objects (Project/Sequence/Track/TrackItem/Component/Param/Markers) and module/namespace objects is safe. The crash vector is READING param value-wrappers, not listing method names on DOM nodes.

**Captions: text is NOT readable via UXP 2026.** `sequence.getCaptionTrackCount()` / `getCaptionTrack(i)` exist; caption track has `getTrackItems(1,false)` → caption items. But each caption item's `getName()`/`getMatchName()` returns only the literal `"SyntheticCaption"`, its component chain is empty, and `getProjectItem()` is null. The only text API is `ppro.Transcript.exportToJSON` / `importFromJSON` / `createImportTextSegmentsAction` — `exportToJSON` rejects Sequence/Project/ProjectItem/CaptionTrack/caption-item/string ("Invalid parameter" / "Illegal Parameter type"); it appears to consume a `TextSegments` object you build (a writer/round-trip API), not a reader of existing timeline captions. **You CAN read each caption's exact in/out via `getStartTime()`/`getEndTime()` (TickTime).** To locate a known caption, match by timecode and `sequence.setPlayerPosition(tickTime)` to move the playhead.

**eval needs a manifest permission.** `new Function`/`eval` require `requiredPermissions.allowCodeGenerationFromStrings: true` in manifest.json.
