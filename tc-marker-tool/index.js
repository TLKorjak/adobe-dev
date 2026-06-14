// index.js — TC Markers panel. Load a transcript .docx, find yellow-highlighted
// syncs, drop a colored comment marker per sync on the active sequence.

const fflate = require("./lib/fflate.min.js");
const { parseDocxXml, summarize } = require("./docxParse.js");
const { applyMarkers, activeSequenceName } = require("./markers.js");
const uxp = require("uxp");

const $seq = document.getElementById("seq");
const $refresh = document.getElementById("refresh");
const $dropzone = document.getElementById("dropzone");
const $droptitle = document.getElementById("droptitle");
const $fileinfo = document.getElementById("fileinfo");
const $color = document.getElementById("color");
const $apply = document.getElementById("apply");
const $resultcard = document.getElementById("resultcard");
const $resicon = document.getElementById("resicon");
const $restitle = document.getElementById("restitle");
const $resmsg = document.getElementById("resmsg");
const $toggleLog = document.getElementById("toggleLog");
const $log = document.getElementById("log");

const ICON_OK = "✓";
const ICON_ERR = "✕";

let rows = null;
let fileName = null;

// apply is a div-button (no native `disabled`); manage via class + flag
function setApplyEnabled(on) {
  if (on) $apply.classList.remove("disabled");
  else $apply.classList.add("disabled");
}
function applyEnabled() { return !$apply.classList.contains("disabled"); }

function setResult(ok, title, msg, detail) {
  $resultcard.classList.remove("hidden");
  $resicon.className = "resicon " + (ok ? "ok" : "err");
  $resicon.innerHTML = ok ? ICON_OK : ICON_ERR;
  $restitle.textContent = title;
  $resmsg.textContent = msg || "";
  $log.textContent = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
}

async function refreshSeq() {
  try {
    const name = await activeSequenceName();
    $seq.textContent = name || "(no active sequence)";
  } catch (e) {
    $seq.textContent = "error";
  }
}

$refresh.addEventListener("click", refreshSeq);

// expandable technical log
$toggleLog.addEventListener("click", function () {
  const hidden = $log.classList.toggle("hidden");
  $toggleLog.classList.toggle("open", !hidden);
});

// file pick + parse
$dropzone.addEventListener("click", async function () {
  try {
    const file = await uxp.storage.localFileSystem.getFileForOpening({ types: ["docx"] });
    if (!file) return;
    fileName = file.name;
    const buf = await file.read({ format: uxp.storage.formats.binary });
    const u8 = new Uint8Array(buf);
    const entries = fflate.unzipSync(u8, { filter: function (f) { return f.name === "word/document.xml"; } });
    const docXml = entries["word/document.xml"];
    if (!docXml) throw new Error("word/document.xml not found — is this a .docx?");
    rows = parseDocxXml(fflate.strFromU8(docXml));
    const s = summarize(rows);
    $droptitle.textContent = fileName;
    $fileinfo.classList.remove("muted");
    $fileinfo.textContent =
      s.highlighted + " sync(s) highlighted · " + s.total + " tc rows · " +
      (s.first || "?") + " → " + (s.last || "?");
    setApplyEnabled(s.highlighted > 0);
  } catch (e) {
    rows = null;
    setApplyEnabled(false);
    $droptitle.textContent = "Select Marker Document";
    $fileinfo.textContent = "Load failed: " + String(e);
    setResult(false, "Load failed", String(e), (e && e.stack) || String(e));
  }
});

// apply
$apply.addEventListener("click", async function () {
  if (!rows || !applyEnabled()) return;
  setApplyEnabled(false);
  setResult(true, "Working…", "", "");
  try {
    const res = await applyMarkers(rows, {
      colorIndex: parseInt($color.value, 10),
      clearFirst: false
    });
    const bits = [];
    if (res.cleared) bits.push(res.cleared + " cleared");
    if (res.skippedOutOfRange) bits.push(res.skippedOutOfRange + " out-of-range");
    if (res.skippedDuplicateFrame) bits.push(res.skippedDuplicateFrame + " dup-frame");
    setResult(
      true,
      "Last Action: Success",
      res.markersAdded + " markers added to " + res.sequence +
        (bits.length ? " (" + bits.join(", ") + ")" : ""),
      res
    );
  } catch (e) {
    setResult(false, "Last Action: Failed", String(e), (e && e.stack) || String(e));
  } finally {
    setApplyEnabled(true);
  }
});

// boot
refreshSeq();
