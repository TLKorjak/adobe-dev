// index.js — TC Markers panel. Load a transcript .docx, find yellow-highlighted
// syncs, drop a colored comment marker per sync on the active sequence.

const fflate = require("./lib/fflate.min.js");
const { parseDocxXml, summarize } = require("./docxParse.js");
const { applyMarkers, activeSequenceName } = require("./markers.js");
const uxp = require("uxp");

const $seq = document.getElementById("seq");
const $refresh = document.getElementById("refresh");
const $pick = document.getElementById("pick");
const $fileinfo = document.getElementById("fileinfo");
const $color = document.getElementById("color");
const $clearFirst = document.getElementById("clearFirst");
const $apply = document.getElementById("apply");
const $result = document.getElementById("result");
const $log = document.getElementById("log");

let rows = null;        // parsed [{tc,hl,comment}]
let fileName = null;

function log() {
  const parts = Array.prototype.slice.call(arguments).map(function (a) {
    return typeof a === "string" ? a : JSON.stringify(a, null, 2);
  });
  $log.textContent += parts.join(" ") + "\n";
  $log.scrollTop = $log.scrollHeight;
}

async function refreshSeq() {
  try {
    const name = await activeSequenceName();
    $seq.textContent = name || "(no active sequence)";
  } catch (e) {
    $seq.textContent = "error";
    log("sequence read error:", String(e));
  }
}

$refresh.addEventListener("click", refreshSeq);

$pick.addEventListener("click", async function () {
  try {
    const file = await uxp.storage.localFileSystem.getFileForOpening({ types: ["docx"] });
    if (!file) return;
    fileName = file.name;
    const buf = await file.read({ format: uxp.storage.formats.binary });
    const u8 = new Uint8Array(buf);
    const entries = fflate.unzipSync(u8, {
      filter: function (f) { return f.name === "word/document.xml"; }
    });
    const docXml = entries["word/document.xml"];
    if (!docXml) throw new Error("word/document.xml not found — is this a .docx?");
    const xml = fflate.strFromU8(docXml);
    rows = parseDocxXml(xml);
    const s = summarize(rows);
    $fileinfo.textContent =
      fileName + " — " + s.highlighted + " highlighted sync(s) of " +
      s.total + " tc rows (" + (s.first || "?") + " → " + (s.last || "?") + ")";
    $fileinfo.classList.remove("muted");
    $apply.disabled = s.highlighted === 0;
    log("loaded:", fileName, "| highlighted:", s.highlighted, "| tc rows:", s.total);
  } catch (e) {
    $fileinfo.textContent = "Load failed: " + String(e);
    log("load error:", String(e), e && e.stack);
    rows = null;
    $apply.disabled = true;
  }
});

$apply.addEventListener("click", async function () {
  if (!rows) return;
  $apply.disabled = true;
  $result.textContent = "Working…";
  try {
    const res = await applyMarkers(rows, {
      colorIndex: parseInt($color.value, 10),
      clearFirst: $clearFirst.checked
    });
    $result.textContent =
      "✓ " + res.markersAdded + " marker(s) added, " + res.colored + " colored" +
      (res.cleared ? ", " + res.cleared + " cleared" : "") +
      (res.skippedOutOfRange ? ", " + res.skippedOutOfRange + " out-of-range" : "") +
      (res.skippedDuplicateFrame ? ", " + res.skippedDuplicateFrame + " dup-frame" : "") +
      " — on “" + res.sequence + "”.";
    log("result:", res);
  } catch (e) {
    $result.textContent = "✗ " + String(e);
    log("apply error:", String(e), e && e.stack);
  } finally {
    $apply.disabled = false;
  }
});

// boot
refreshSeq();
log("TC Markers ready. ppro " + (require("premierepro").version || "?"));
