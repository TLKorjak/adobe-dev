---
name: Premiere Pro Scripting API Reference
description: Comprehensive reference for Adobe Premiere Pro ExtendScript scripting API — object model, key methods, common patterns, and differences from After Effects
type: reference
---

Source: https://ppro-scripting.docsforadobe.dev/

## Critical Notes

- **ExtendScript is frozen at PPro 23.0** — no further API changes planned. Future is UXP. ExtendScript support continues through September 2026.
- Same ES3 constraints as After Effects (var only, no arrow functions, no Array methods, etc.)
- **No expressions** in Premiere — effects are keyframed or static only.
- **Collections are 0-indexed** (unlike AE which is 1-indexed).
- **Time is inconsistent** — some APIs use seconds (float), some use ticks (string, 254016000000/sec), some use Time objects.

---

## Object Model Hierarchy

```
app
 ├── project (Project)
 │    ├── rootItem (ProjectItem, type=ROOT)
 │    │    └── children[] (ProjectItemCollection)
 │    │         └── ProjectItem (type=CLIP, BIN, FILE)
 │    ├── sequences[] (SequenceCollection)
 │    │    └── Sequence
 │    │         ├── videoTracks[] / audioTracks[]
 │    │         │    └── Track
 │    │         │         ├── clips[] (TrackItemCollection)
 │    │         │         │    └── TrackItem
 │    │         │         │         ├── components[] (effects)
 │    │         │         │         │    └── Component → properties[] → ComponentParam
 │    │         │         │         └── projectItem (back-reference)
 │    │         │         └── transitions[]
 │    │         └── markers (MarkerCollection)
 │    └── activeSequence
 ├── encoder (Adobe Media Encoder)
 ├── metadata
 ├── sourceMonitor
 ├── projectManager
 └── projects[] (all open projects)
```

---

## Key Objects Reference

### Application (`app`)

| Method/Property | Description |
|---|---|
| `app.project` | Active project |
| `app.openDocument(path)` | Open a .prproj |
| `app.newProject(path)` | Create new project |
| `app.enableQE()` | Enable QE DOM (extended undocumented API) |
| `app.setSDKEventMessage(msg, type)` | Write to Events panel ("info", "warning", "error") |
| `app.encoder` | Access Adobe Media Encoder |
| `app.getWorkspaces()` / `app.setWorkspace()` | Workspace control |

### Project (`app.project`)

| Method/Property | Description |
|---|---|
| `activeSequence` | Current timeline (or 0) |
| `rootItem` | Project bin root |
| `sequences` | All sequences |
| `importFiles(paths[], suppressUI, targetBin, asStills)` | Import media |
| `importAEComps(aepPath, compNames, targetBin)` | Import AE comps (Dynamic Link) |
| `createNewSequence(name, id)` | New sequence |
| `createNewSequenceFromClips(name, clips[], destBin)` | Sequence from clips |
| `exportFinalCutProXML()` / `exportAAF()` / `exportOMF()` | Interchange exports |
| `save()` / `saveAs(path)` / `closeDocument()` | Project management |
| `addPropertyToProjectMetadataSchema(name, label, type)` | Extend metadata schema |

### Sequence

| Method/Property | Description |
|---|---|
| `videoTracks` / `audioTracks` | TrackCollections |
| `markers` | MarkerCollection |
| `insertClip(item, time, vTrack, aTrack)` | Insert edit |
| `overwriteClip(item, time, vTrack, aTrack)` | Overwrite edit |
| `getPlayerPosition()` / `setPlayerPosition(time)` | CTI control |
| `getInPoint()` / `setInPoint()` / `getOutPoint()` / `setOutPoint()` | In/out points |
| `getSelection()` | Selected TrackItems |
| `exportAsMediaDirect(outputPath, presetPath, workAreaType)` | Direct export (0=entire, 1=in/out, 2=work area) |
| `getSettings()` / `setSettings()` | Sequence settings |
| `importMGT(mogrtPath, time, vOff, aOff)` | Insert Motion Graphics Template |
| `frameSizeHorizontal` / `frameSizeVertical` | Resolution |
| `name` | Read/write |

### ProjectItem

| Method/Property | Description |
|---|---|
| `type` | "CLIP", "BIN", "ROOT", "FILE" |
| `name` | Read/write |
| `getMediaPath()` | Path to source media |
| `changeMediaPath(newPath, override)` | Relink media |
| `createBin(name)` | Create sub-bin |
| `setInPoint()` / `setOutPoint()` / `clearInPoint()` / `clearOutPoint()` | Source range |
| `getMarkers()` | MarkerCollection |
| `getXMPMetadata()` / `setXMPMetadata()` | XMP metadata |
| `getProjectMetadata()` / `setProjectMetadata()` | PPro-private metadata |
| `getFootageInterpretation()` / `setFootageInterpretation()` | Alpha, frame rate, VR, pixel aspect |
| `attachProxy()` / `hasProxy()` / `getProxyPath()` | Proxy workflow |
| `setColorLabel(index)` / `getColorLabel()` | Label colors (0-15) |
| `videoComponents()` | Master clip effects |
| `isOffline()` / `setOffline()` / `refreshMedia()` | Online/offline control |
| `moveBin(newParent)` | Reorganize bins |

### TrackItem (clip on timeline)

| Method/Property | Description |
|---|---|
| `start` / `end` | Position in sequence (read/write) |
| `inPoint` / `outPoint` | Source in/out (read/write) |
| `duration` | Length (read-only) |
| `name` | Display name (read/write) |
| `components` | ComponentCollection (effects + intrinsic transforms) |
| `projectItem` | Back-reference to source |
| `disabled` | Enable/disable (read/write, v15.4+) |
| `getSpeed()` / `isSpeedReversed()` | Speed info |
| `setSelected(state, updateUI)` | Selection control |
| `remove(ripple, alignToVideo)` | Delete clip |
| `move(newInPoint)` | Move clip (v15.4+) |

### Track

| Method/Property | Description |
|---|---|
| `clips` | TrackItemCollection |
| `transitions` | TrackItemCollection |
| `insertClip(item, time, vTrack, aTrack)` | Add clip |
| `overwriteClip(item, time)` | Overwrite clip |
| `isMuted()` / `setMute(state)` | Mute control |
| `name` / `mediaType` / `id` | Info |

### Component & ComponentParam (effects)

| Method/Property | Description |
|---|---|
| `component.displayName` | Localized name |
| `component.matchName` | Internal identifier |
| `component.properties` | ComponentParamCollection |
| `param.getValue()` / `param.setValue(val, updateUI)` | Get/set value |
| `param.getValueAtTime(time)` / `param.setValueAtKey(time, val, updateUI)` | Keyframed values |
| `param.addKey(time)` / `param.removeKey(time)` | Keyframe management |
| `param.getKeys()` | All keyframe times |
| `param.areKeyframesSupported()` / `param.isTimeVarying()` | Keyframe support check |
| `param.setInterpolationTypeAtKey(time, type, updateUI)` | 0=Linear, 4=Hold, 5=Bezier |
| `param.setColorValue(a, r, g, b, updateUI)` / `param.getColorValue()` | Color params |

### Markers

| Method/Property | Description |
|---|---|
| `markers.createMarker(timeInSeconds)` | Create marker |
| `markers.deleteMarker(marker)` | Remove marker |
| `markers.getFirstMarker()` / `getLastMarker()` | Navigation |
| `markers.getNextMarker(m)` / `getPrevMarker(m)` | Navigation |
| `marker.name` / `marker.comments` / `marker.start` / `marker.end` | Properties |
| `marker.type` | Comment, Chapter, Segmentation, WebLink |
| `marker.setColorByIndex(colorIndex, markerIndex)` | 0=Green, 1=Red, 2=Purple, 3=Orange, 4=Yellow, 5=White, 6=Blue, 7=Cyan |

### Encoder (`app.encoder`)

| Method/Property | Description |
|---|---|
| `launchEncoder()` | Start AME |
| `encodeSequence(seq, outputPath, presetPath, workArea, removeOnComplete)` | Queue encode |
| `encodeProjectItem(item, outputPath, presetPath, workArea, removeOnComplete)` | Queue item |
| `startBatch()` | Start encoding |
| `setSidecarXMPEnabled(state)` | Enable sidecar XMP |
| `setEmbeddedXMPEnabled(state)` | Enable embedded XMP |

---

## Common Patterns

### Import Footage

```jsx
var filesToImport = ["/path/to/video.mp4", "/path/to/audio.wav"];
app.project.importFiles(filesToImport, true, app.project.rootItem, false);
```

### Insert Clip on Timeline

```jsx
var seq = app.project.activeSequence;
var item = app.project.rootItem.children[0];
seq.insertClip(item, "5.0", 0, 0); // at 5s, video track 0, audio track 0
```

### Modify Effect Parameters

```jsx
var clip = seq.videoTracks[0].clips[0];
var components = clip.components;
for (var i = 0; i < components.numItems; i++) {
    var comp = components[i];
    for (var j = 0; j < comp.properties.numItems; j++) {
        var param = comp.properties[j];
        // param.setValue(newValue, true);
    }
}
```

### Export via AME

```jsx
app.encoder.launchEncoder();
app.encoder.encodeSequence(seq, "/output/file.mp4", "/path/to/preset.epr", 0, 0);
app.encoder.startBatch();
```

### Direct Export

```jsx
seq.exportAsMediaDirect("/output/file.mp4", "/path/to/preset.epr", 0);
// 0=entire, 1=in/out, 2=work area
```

---

## Key Differences from After Effects

| Aspect | After Effects | Premiere Pro |
|---|---|---|
| Object root | `app.project.item(n)` | `app.project.rootItem.children[n]` |
| Timeline model | Comps with layers (stacked) | Sequences with tracks + clips at specific times |
| Effects access | `layer.property("Effects").property("name")` | `trackItem.components[i].properties[j]` |
| Time | Seconds (float) everywhere | Mixed: seconds, ticks (254016000000/sec), Time objects |
| Rendering | `app.project.renderQueue` | `app.encoder` or `seq.exportAsMediaDirect()` |
| Expressions | Rich expression language | None — keyframed or static only |
| Undo groups | `app.beginUndoGroup()` / `app.endUndoGroup()` | Not documented |
| Collections | 1-indexed | 0-indexed |
| API status | Actively developed | Frozen at v23.0, moving to UXP |
