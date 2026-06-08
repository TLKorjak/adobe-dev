// Premiere Bridge — general-purpose UXP automation bridge for Premiere Pro 2026.
//
// PPro 2026 removed the AppleScript DoScriptFile bridge, so UXP is the only
// automation channel. This panel exposes the full UXP `premierepro` API to the
// chat session over a file-based IPC channel (the plugin's own data folder):
//
//   chat  --writes cmd.json-->  dataFolder  --polled @400ms-->  plugin (this file)
//   chat  <--reads result.json--  dataFolder  <--writes result--  plugin
//
// Universal command:
//   { "cmd":"eval", "code":"<async JS body>" }
//       Runs arbitrary JS with `ppro`, `uxp`, and helpers `h` in scope, and
//       returns whatever the body returns (safely serialized). This is the
//       engine that lets the tool perform ANY task — markers, trims, MOGRT
//       params, captions — without a hand-written handler per task.
//
// Discovery / convenience commands:
//   { "cmd":"ping" }
//   { "cmd":"introspect", "target":"ppro"|"project"|"sequence"|"firstClip"|"path", "path":"sequence.getMarkers" }
//   { "cmd":"activeState" }
//   { "cmd":"dumpSequence" }
//   { "cmd":"describeClip", "track":<int>, "clip":<int> }

const ppro = require('premierepro');
const uxp = require('uxp');

let DATA_FOLDER = null;
let DATA_FOLDER_PATH = '';
const CMD_NAME = 'cmd.json';
const RESULT_NAME = 'result.json';
const POLL_MS = 400;

const $status = document.getElementById('status');
const $dot = document.getElementById('dot');
const $log = document.getElementById('log');
const $clear = document.getElementById('clear');
const $copy = document.getElementById('copy');
const $ping = document.getElementById('ping');
const $state = document.getElementById('state');
const $ipcpath = document.getElementById('ipcpath');

function log() {
  const args = Array.prototype.slice.call(arguments);
  const line = args.map(function (a) {
    return typeof a === 'string' ? a : JSON.stringify(a, null, 2);
  }).join(' ');
  $log.textContent += line + '\n';
  $log.scrollTop = $log.scrollHeight;
}

function setStatus(text, state) {
  $status.textContent = text;
  $dot.className = 'dot' + (state ? ' ' + state : '');
}

$clear.addEventListener('click', function () { $log.textContent = ''; });

$copy.addEventListener('click', async function () {
  const text = $log.textContent || '';
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      await uxp.clipboard.setContent({ 'text/plain': text });
    }
    setStatus('log copied', 'on');
  } catch (e) {
    log('copy failed', String(e));
  }
});

$ping.addEventListener('click', async function () {
  log('manual ping →', await dispatch({ cmd: 'ping' }));
});
$state.addEventListener('click', async function () {
  log('manual activeState →', truncate(await dispatch({ cmd: 'activeState' })));
});

// ---------- safe serialization ----------
// eval bodies should return plain data; this is a guard, not a license to
// return raw UXP value-wrappers (those can crash on stringify — see notes).
function safeSerialize(v) {
  if (v === undefined) return { __type: 'undefined' };
  if (v === null) return null;
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return v;
  if (t === 'function') return { __type: 'function', name: v.name || null };
  try {
    const seen = [];
    return JSON.parse(JSON.stringify(v, function (k, val) {
      if (typeof val === 'function') return '[Function]';
      if (val && typeof val === 'object') {
        if (seen.indexOf(val) !== -1) return '[Circular]';
        seen.push(val);
      }
      return val;
    }));
  } catch (e) {
    return { __unserializable: true, type: t, string: String(v) };
  }
}

// List property+method names along the prototype chain WITHOUT reading values.
// Safe for DOM objects (Project/Sequence/Track/Component/Param) and modules.
// Do NOT point this at value-wrappers from getStartValue()/getValueAtTime().
function memberNames(obj) {
  const names = {};
  let o = obj;
  let depth = 0;
  while (o && depth < 8) {
    const own = Object.getOwnPropertyNames(o);
    for (let i = 0; i < own.length; i++) {
      const n = own[i];
      if (n === 'constructor') continue;
      if (!(n in names)) {
        let kind = 'prop';
        try { kind = (typeof o[n] === 'function') ? 'method' : 'prop'; } catch (e) { kind = '?'; }
        names[n] = kind;
      }
    }
    o = Object.getPrototypeOf(o);
    depth++;
  }
  return names;
}

// ---------- helpers exposed to eval ----------
async function getProject() {
  return await ppro.Project.getActiveProject();
}
async function getSequence() {
  const p = await getProject();
  if (!p) return null;
  return await p.getActiveSequence();
}
async function getVideoTrackCount(seq) {
  if (typeof seq.getVideoTrackCount === 'function') return await seq.getVideoTrackCount();
  let n = 0;
  while (n <= 64) { const t = await seq.getVideoTrack(n); if (!t) break; n++; }
  return n;
}
async function getClip(track, clip) {
  const seq = await getSequence();
  if (!seq) throw new Error('no active sequence');
  const t = await seq.getVideoTrack(track);
  if (!t) throw new Error('no video track ' + track);
  let items;
  try { items = await t.getTrackItems(1, false); }
  catch (e) { items = await t.getTrackItems(); }
  const c = items[clip];
  if (!c) throw new Error('no clip ' + clip + ' on track ' + track);
  return c;
}

const HELPERS = {
  ppro: ppro,
  uxp: uxp,
  log: log,
  memberNames: memberNames,
  getProject: getProject,
  getSequence: getSequence,
  getVideoTrackCount: getVideoTrackCount,
  getClip: getClip,
};

// ---------- command dispatch ----------
async function dispatch(cmd) {
  switch (cmd.cmd) {
    case 'ping':        return { ok: true, version: ppro.version, dataFolder: DATA_FOLDER_PATH };
    case 'eval':        return await evalCmd(cmd);
    case 'introspect':  return await introspect(cmd);
    case 'activeState': return await activeState();
    case 'dumpSequence':return await dumpSequence();
    case 'describeClip':return await describeClip(cmd.track, cmd.clip);
    case 'listMarkers': return await listMarkers();
    case 'addMarker':   return await addMarkers({ markers: [{ seconds: cmd.seconds, name: cmd.name, comment: cmd.comment }], clearExisting: false });
    case 'addMarkers':  return await addMarkers(cmd);
    case 'clearMarkers':return await clearMarkers();
    default:            return { error: 'unknown command: ' + cmd.cmd };
  }
}

// ---------- eval: the universal command ----------
async function evalCmd(cmd) {
  if (typeof cmd.code !== 'string') return { error: 'eval requires a "code" string' };
  let fn;
  try {
    fn = new Function('ppro', 'uxp', 'h',
      '"use strict"; return (async function(){ ' + cmd.code + '\n })();');
  } catch (e) {
    return { error: 'compile error: ' + String(e) };
  }
  try {
    const value = await fn(ppro, uxp, HELPERS);
    return { ok: true, value: safeSerialize(value) };
  } catch (e) {
    return { error: String(e), stack: e && e.stack };
  }
}

// ---------- introspect: discover the live API ----------
async function introspect(cmd) {
  const target = cmd.target || 'ppro';
  let obj = null;
  let label = target;
  try {
    if (target === 'ppro') obj = ppro;
    else if (target === 'uxp') obj = uxp;
    else if (target === 'project') obj = await getProject();
    else if (target === 'sequence') obj = await getSequence();
    else if (target === 'firstClip') obj = await getClip(0, 0);
    else if (target === 'path') {
      // walk a dot path off `ppro` or the active sequence, e.g. "Constants" or "sequence.getMarkers"
      obj = await resolvePath(cmd.path);
      label = cmd.path;
    } else return { error: 'unknown introspect target: ' + target };
  } catch (e) {
    return { error: 'resolve failed for ' + target + ': ' + String(e) };
  }
  if (obj === null || obj === undefined) return { ok: true, target: label, value: obj === null ? 'null' : 'undefined' };
  return { ok: true, target: label, typeof: typeof obj, members: memberNames(obj) };
}

async function resolvePath(path) {
  if (!path) return ppro;
  const parts = String(path).split('.');
  let cur;
  let start = 0;
  if (parts[0] === 'sequence') { cur = await getSequence(); start = 1; }
  else if (parts[0] === 'project') { cur = await getProject(); start = 1; }
  else { cur = ppro; }
  for (let i = start; i < parts.length; i++) {
    if (cur == null) return cur;
    cur = cur[parts[i]];
  }
  return cur;
}

// ---------- activeState ----------
async function activeState() {
  const project = await getProject();
  if (!project) return { ok: true, project: null };
  const out = { ok: true, version: ppro.version, project: { name: project.name } };
  const seq = await project.getActiveSequence();
  if (!seq) { out.sequence = null; return out; }
  const s = { name: seq.name };
  try { s.videoTrackCount = await getVideoTrackCount(seq); } catch (e) { s.videoTrackCount = 'err:' + e; }
  try {
    if (typeof seq.getAudioTrackCount === 'function') s.audioTrackCount = await seq.getAudioTrackCount();
  } catch (e) {}
  out.sequence = s;
  return out;
}

// ---------- dumpSequence (all clips, conservative — names only) ----------
async function dumpSequence() {
  const seq = await getSequence();
  if (!seq) return { error: 'no active sequence' };
  const seqInfo = { name: seq.name, tracks: [] };
  const trackCount = await getVideoTrackCount(seq);
  for (let ti = 0; ti < trackCount; ti++) {
    const track = await seq.getVideoTrack(ti);
    if (!track) continue;
    const trackInfo = { index: ti, name: track.name, clips: [] };
    let items = [];
    try { items = await track.getTrackItems(1, false); }
    catch (e) { try { items = await track.getTrackItems(); } catch (e2) {} }
    for (let ci = 0; ci < items.length; ci++) {
      const clip = items[ci];
      const clipInfo = { index: ci, name: clip.name };
      try { const pi = await clip.getProjectItem(); if (pi) clipInfo.projectItem = { name: pi.name, type: pi.type }; } catch (e) {}
      trackInfo.clips.push(clipInfo);
    }
    seqInfo.tracks.push(trackInfo);
  }
  return { ok: true, sequence: seqInfo };
}

// ---------- describeClip (one clip's components + param displayNames) ----------
async function describeClip(trackIdx, clipIdx) {
  if (typeof trackIdx !== 'number' || typeof clipIdx !== 'number') {
    return { error: 'usage: { cmd:"describeClip", track:<int>, clip:<int> }' };
  }
  const clip = await getClip(trackIdx, clipIdx);
  const out = { track: trackIdx, clip: clipIdx, clipName: clip.name, components: [] };
  try { const pi = await clip.getProjectItem(); if (pi) out.projectItem = { name: pi.name, type: pi.type }; } catch (e) {}
  const chain = await clip.getComponentChain();
  const compCount = await chain.getComponentCount();
  out.componentCount = compCount;
  for (let k = 0; k < compCount; k++) {
    const comp = await chain.getComponentAtIndex(k);
    const compInfo = { index: k, params: [] };
    let paramCount = 0;
    try { paramCount = await comp.getParamCount(); } catch (e) {}
    compInfo.paramCount = paramCount;
    for (let p = 0; p < paramCount; p++) {
      try {
        const param = await comp.getParam(p);
        compInfo.params.push({ index: p, displayName: (param && typeof param.displayName === 'string') ? param.displayName : null });
      } catch (e) { compInfo.params.push({ index: p, error: String(e) }); }
    }
    out.components.push(compInfo);
  }
  return { ok: true, ...out };
}

// ---------- Markers ----------
// Validated pattern (PPro 2026): markers = await ppro.Markers.getMarkers(seq);
// build action with markers.createAddMarkerAction(name, type, startTickTime, durTickTime, comment),
// then project.lockedAccess(() => project.executeTransaction(tx => tx.addAction(action), label)).
// NOTE: Premiere disallows two sequence markers on the same frame — addMarkers merges
// same-time entries into one marker by default (mergeSameTime !== false).
async function getMarkersColl() {
  const seq = await getSequence();
  if (!seq) throw new Error('no active sequence');
  const project = await getProject();
  const markers = await ppro.Markers.getMarkers(seq);
  return { seq: seq, project: project, markers: markers };
}

async function listMarkers() {
  const ctx = await getMarkersColl();
  const arr = await ctx.markers.getMarkers();
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const mk = arr[i];
    const row = { index: i };
    try { row.name = await mk.getName(); } catch (e) {}
    try { row.comment = await mk.getComments(); } catch (e) {}
    try { const st = await mk.getStart(); row.startSeconds = st.seconds; } catch (e) {}
    out.push(row);
  }
  return { ok: true, count: out.length, markers: out };
}

async function clearMarkers() {
  const ctx = await getMarkersColl();
  const arr = await ctx.markers.getMarkers();
  const n = arr.length;
  if (n) {
    await ctx.project.lockedAccess(function () {
      ctx.project.executeTransaction(function (tx) {
        for (let i = 0; i < arr.length; i++) tx.addAction(ctx.markers.createRemoveMarkerAction(arr[i]));
      }, 'Bridge: clear markers');
    });
  }
  return { ok: true, removed: n };
}

// cmd: { markers:[{seconds,name,comment}], clearExisting?:bool, mergeSameTime?:bool(default true) }
async function addMarkers(cmd) {
  const list = (cmd && cmd.markers) || [];
  if (!list.length) return { error: 'addMarkers requires a non-empty "markers" array' };
  const ctx = await getMarkersColl();
  const T = ppro.Marker.MARKER_TYPE_COMMENT;
  const z = ppro.TickTime.TIME_ZERO;

  if (cmd.clearExisting) await clearMarkers();

  // merge same-time entries unless explicitly disabled
  const merge = cmd.mergeSameTime !== false;
  const order = [];
  const groups = {};
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const key = merge ? String(m.seconds) : (i + '_' + m.seconds);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(m);
  }

  let added = 0;
  await ctx.project.lockedAccess(function () {
    ctx.project.executeTransaction(function (tx) {
      for (let gi = 0; gi < order.length; gi++) {
        const g = groups[order[gi]];
        const seconds = g[0].seconds;
        const names = [], comments = [];
        for (let j = 0; j < g.length; j++) {
          if (g[j].name) names.push(g[j].name);
          if (g[j].comment) comments.push(g[j].comment);
        }
        const name = names.join(' / ') || '';
        const comment = comments.join(' | ') || '';
        const tt = ppro.TickTime.createWithSeconds(seconds);
        tx.addAction(ctx.markers.createAddMarkerAction(String(name), T, tt, z, String(comment)));
        added++;
      }
    }, 'Bridge: add ' + order.length + ' marker(s)');
  });

  const after = await ctx.markers.getMarkers();
  return { ok: true, requested: list.length, markersAdded: added, markersNow: after.length };
}

// ---------- File IPC ----------
async function findCmdEntry() {
  if (!DATA_FOLDER) return null;
  try {
    const entries = await DATA_FOLDER.getEntries();
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].name === CMD_NAME && entries[i].isFile) return entries[i];
    }
  } catch (e) {}
  return null;
}
async function readCmd(entry) {
  try { return JSON.parse(await entry.read()); } catch (e) { return null; }
}
async function writeResult(obj) {
  if (!DATA_FOLDER) return;
  let entry = null;
  try { entry = await DATA_FOLDER.getEntry(RESULT_NAME); } catch (e) { entry = null; }
  if (!entry) entry = await DATA_FOLDER.createEntry(RESULT_NAME, { type: uxp.storage.types.file, overwrite: true });
  await entry.write(JSON.stringify(obj, null, 2));
}
async function deleteEntry(entry) { try { await entry.delete(); } catch (e) {} }

// ---------- poll loop ----------
let busy = false;
let tickCounter = 0;
async function tick() {
  if (busy || !DATA_FOLDER) return;
  busy = true;
  try {
    tickCounter++;
    if (tickCounter % 75 === 0) log('… heartbeat ' + tickCounter);
    const cmdEntry = await findCmdEntry();
    if (!cmdEntry) return;
    const cmd = await readCmd(cmdEntry);
    await deleteEntry(cmdEntry); // claim before running
    if (!cmd) { await writeResult({ error: 'malformed command file' }); return; }
    log('▶', truncate(cmd));
    setStatus('running ' + cmd.cmd, 'busy');
    let result;
    try { result = await dispatch(cmd); }
    catch (e) { result = { error: String(e), stack: e && e.stack }; }
    await writeResult(result);
    log('◀', truncate(result));
    setStatus('listening', 'on');
  } catch (e) {
    log('tick error', String(e));
  } finally {
    busy = false;
  }
}
function truncate(obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return s && s.length > 500 ? s.slice(0, 500) + '…' : s;
}

// ---------- boot ----------
async function boot() {
  try {
    log('Premiere Bridge loaded. ppro.version=' + (ppro.version || '?'));
    DATA_FOLDER = await uxp.storage.localFileSystem.getDataFolder();
    DATA_FOLDER_PATH = DATA_FOLDER.nativePath || '';
    $ipcpath.textContent = 'IPC: ' + DATA_FOLDER_PATH;
    log('IPC data folder:', DATA_FOLDER_PATH);
    setStatus('listening', 'on');
    setInterval(tick, POLL_MS);
    log('poll loop @ ' + POLL_MS + 'ms — ready for cmd.json');
  } catch (e) {
    setStatus('boot error', 'err');
    log('boot error', String(e), e && e.stack);
  }
}

boot();
