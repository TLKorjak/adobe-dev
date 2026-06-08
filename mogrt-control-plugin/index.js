// MOGRT Control — UXP plugin for PPro 25.6+
//
// Polls /tmp/ppro-mogrt-cmd.json every 500ms. When a command is found, executes it
// against PPro's UXP API, writes result to /tmp/ppro-mogrt-result.json, deletes cmd.
//
// Commands implemented:
//   { "cmd": "listMogrts" }   — dump every clip + components + params in active sequence
//   { "cmd": "ping" }         — sanity check

const ppro = require('premierepro');
const uxp = require('uxp');

// IPC uses UXP's localFileSystem storage API on the plugin's data folder.
// (Node fs.existsSync is unreliable in UXP; the storage API is canonical.)
let DATA_FOLDER = null;       // Folder Entry
let DATA_FOLDER_PATH = '';     // native path, surfaced for chat-side reads/writes
const CMD_NAME = 'cmd.json';
const RESULT_NAME = 'result.json';
const POLL_MS = 500;

const $status = document.getElementById('status');
const $dot = document.getElementById('dot');
const $log = document.getElementById('log');
const $refresh = document.getElementById('refresh');
const $clear = document.getElementById('clear');

function log(...args) {
  const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
  $log.textContent += line + '\n';
  $log.scrollTop = $log.scrollHeight;
}

function setStatus(text, state) {
  $status.textContent = text;
  $dot.className = 'dot' + (state ? ' ' + state : '');
}

$clear.addEventListener('click', () => { $log.textContent = ''; });

const $copy = document.getElementById('copy');
$copy.addEventListener('click', async () => {
  const text = $log.textContent || '';
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const cb = require('uxp').clipboard;
      await cb.setContent({ 'text/plain': text });
    }
    setStatus('log copied to clipboard', 'on');
  } catch (e) {
    setStatus('copy failed: ' + e, 'err');
    log('copy failed', String(e));
  }
});

// ---------- File IPC (UXP localFileSystem) ----------

async function findCmdEntry() {
  if (!DATA_FOLDER) return null;
  try {
    const entries = await DATA_FOLDER.getEntries();
    for (const e of entries) {
      if (e.name === CMD_NAME && e.isFile) return e;
    }
  } catch (e) {}
  return null;
}

async function readCmd(entry) {
  try {
    const text = await entry.read();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

async function writeResult(obj) {
  if (!DATA_FOLDER) return;
  let entry;
  try {
    entry = await DATA_FOLDER.getEntry(RESULT_NAME);
  } catch (e) {
    entry = null;
  }
  if (!entry) {
    entry = await DATA_FOLDER.createEntry(RESULT_NAME, {
      type: uxp.storage.types.file,
      overwrite: true,
    });
  }
  await entry.write(JSON.stringify(obj, null, 2));
}

async function deleteEntry(entry) {
  try { await entry.delete(); } catch (e) {}
}

// ---------- Command dispatch ----------

async function dispatch(cmd) {
  switch (cmd.cmd) {
    case 'ping':
      return { ok: true, version: ppro.version };
    case 'listMogrts':
      return await listMogrts();
    case 'describeClip':
      return await describeClip(cmd.track, cmd.clip);
    default:
      return { error: 'unknown command: ' + cmd.cmd };
  }
}

// Targeted, low-risk dump for ONE clip. Avoids the calls that crashed PPro:
// no comp.getMatchName(), no comp.getDisplayName(), no value reads.
// Returns project item name (to confirm MOGRT identity), component count,
// and per-component param displayNames (a documented string property).
async function describeClip(trackIdx, clipIdx) {
  if (typeof trackIdx !== 'number' || typeof clipIdx !== 'number') {
    return { error: 'usage: { cmd: "describeClip", track: <int>, clip: <int> }' };
  }
  const project = await ppro.Project.getActiveProject();
  if (!project) return { error: 'no active project' };
  const sequence = await project.getActiveSequence();
  if (!sequence) return { error: 'no active sequence' };

  const track = await sequence.getVideoTrack(trackIdx);
  if (!track) return { error: 'no video track at index ' + trackIdx };

  let items = [];
  try { items = await track.getTrackItems(1, false); }
  catch (e) { items = await track.getTrackItems(); }

  const clip = items[clipIdx];
  if (!clip) return { error: 'no clip at index ' + clipIdx + ' on track ' + trackIdx };

  const out = {
    track: trackIdx,
    clip: clipIdx,
    clipName: clip.name,
  };

  try {
    const pi = await clip.getProjectItem();
    if (pi) out.projectItem = { name: pi.name, type: pi.type };
  } catch (e) {}

  const chain = await clip.getComponentChain();
  const compCount = await chain.getComponentCount();
  out.componentCount = compCount;
  out.components = [];

  for (let k = 0; k < compCount; k++) {
    const comp = await chain.getComponentAtIndex(k);
    const compInfo = { index: k, params: [] };
    let paramCount = 0;
    try { paramCount = await comp.getParamCount(); } catch (e) {}
    compInfo.paramCount = paramCount;
    for (let p = 0; p < paramCount; p++) {
      try {
        const param = await comp.getParam(p);
        const dn = (param && typeof param.displayName === 'string') ? param.displayName : null;
        compInfo.params.push({ index: p, displayName: dn });
      } catch (e) {
        compInfo.params.push({ index: p, error: String(e) });
      }
    }
    out.components.push(compInfo);
  }
  return { ok: true, ...out };
}

// ---------- listMogrts ----------

// Minimal, conservative dump. NO value reading, NO TickTime probing — those
// touch fragile UXP wrapper objects and crashed PPro on the previous attempt.
// Goal here: surface enough info (clip name, project-item name, component
// matchNames, param names) to identify the MOGRT and design targeted setters.
async function listMogrts() {
  const project = await ppro.Project.getActiveProject();
  if (!project) return { error: 'no active project' };

  const sequence = await project.getActiveSequence();
  if (!sequence) return { error: 'no active sequence' };

  const seqInfo = { name: sequence.name, tracks: [] };

  let trackCount = 0;
  if (typeof sequence.getVideoTrackCount === 'function') {
    trackCount = await sequence.getVideoTrackCount();
  } else {
    while (true) {
      const t = await sequence.getVideoTrack(trackCount);
      if (!t) break;
      trackCount++;
      if (trackCount > 64) break;
    }
  }

  for (let ti = 0; ti < trackCount; ti++) {
    const track = await sequence.getVideoTrack(ti);
    if (!track) continue;
    const trackInfo = { index: ti, name: track.name, clips: [] };

    let items = [];
    try { items = await track.getTrackItems(1, false); }
    catch (e) { try { items = await track.getTrackItems(); } catch (e2) {} }

    for (let ci = 0; ci < items.length; ci++) {
      const clip = items[ci];
      const clipInfo = { index: ci, name: clip.name, components: [] };

      try {
        const pi = await clip.getProjectItem();
        if (pi) clipInfo.projectItem = { name: pi.name, type: pi.type };
      } catch (e) {}

      try {
        const chain = await clip.getComponentChain();
        const compCount = await chain.getComponentCount();
        // No await on getMatchName/getDisplayName — those crashed PPro 2026.
        for (let k = 0; k < compCount; k++) {
          const comp = await chain.getComponentAtIndex(k);
          const compInfo = { index: k, params: [] };
          let paramCount = 0;
          try { paramCount = await comp.getParamCount(); } catch (e) {}
          for (let p = 0; p < paramCount; p++) {
            try {
              const param = await comp.getParam(p);
              const dn = (param && typeof param.displayName === 'string') ? param.displayName : null;
              compInfo.params.push({ index: p, displayName: dn });
            } catch (e) {
              compInfo.params.push({ index: p, error: String(e) });
            }
          }
          clipInfo.components.push(compInfo);
        }
      } catch (e) {
        clipInfo.componentChainError = String(e);
      }

      trackInfo.clips.push(clipInfo);
    }
    seqInfo.tracks.push(trackInfo);
  }

  return { ok: true, sequence: seqInfo };
}


// ---------- Poll loop ----------

let busy = false;

let tickCounter = 0;

async function tick() {
  if (busy) return;
  if (!DATA_FOLDER) return;
  busy = true;
  try {
    tickCounter++;
    // Heartbeat every 60 ticks (~30s) so the log proves the loop is alive.
    if (tickCounter % 60 === 0) log('… heartbeat tick=' + tickCounter);

    const cmdEntry = await findCmdEntry();
    if (!cmdEntry) return;

    const cmd = await readCmd(cmdEntry);
    await deleteEntry(cmdEntry); // claim it before running
    if (!cmd) {
      await writeResult({ error: 'malformed command file' });
      return;
    }
    log('▶ cmd:', cmd);
    let result;
    try {
      result = await dispatch(cmd);
    } catch (e) {
      result = { error: String(e), stack: e && e.stack };
    }
    await writeResult(result);
    log('◀ result:', truncate(result));
  } catch (e) {
    log('tick error', String(e));
  } finally {
    busy = false;
  }
}

function truncate(obj) {
  const s = JSON.stringify(obj);
  return s.length > 400 ? s.slice(0, 400) + '…' : s;
}

// ---------- Boot ----------

async function boot() {
  try {
    log('PPro UXP plugin loaded. version=' + (ppro.version || '?'));
    const lfs = uxp.storage.localFileSystem;
    DATA_FOLDER = await lfs.getDataFolder();
    DATA_FOLDER_PATH = DATA_FOLDER.nativePath || '';
    log('IPC data folder: ' + DATA_FOLDER_PATH);
    log('Drop ' + CMD_NAME + ' into that folder; result appears as ' + RESULT_NAME);
    setStatus('listening', 'on');
    setInterval(tick, POLL_MS);
    log('poll loop started @ ' + POLL_MS + 'ms');
  } catch (e) {
    setStatus('boot error: ' + e, 'err');
    log('boot error', String(e), e && e.stack);
  }
}

$refresh.addEventListener('click', async () => {
  log('manual: listMogrts');
  try {
    const r = await listMogrts();
    log(r);
  } catch (e) {
    log('error', String(e));
  }
});

boot();
