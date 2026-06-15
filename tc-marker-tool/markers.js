// markers.js — apply highlighted-sync markers to the active sequence.
// Highlighted rows only: a colored comment marker per sync. Validated pattern
// (PPro 2026 UXP): getMarkers -> createAddMarkerAction -> createSetColorByIndexAction,
// all inside project.lockedAccess(() => project.executeTransaction(...)).

var ppro = require("premierepro");

// rows: [{tc, hl, comment}]
// opts: { colorIndex=1 (red), clearFirst=true, fps=25 }
async function applyMarkers(rows, opts) {
  opts = opts || {};
  var colorIndex = opts.colorIndex == null ? 1 : opts.colorIndex;
  var clearFirst = opts.clearFirst !== false;
  var fps = opts.fps || 25;

  var hlRows = rows.filter(function (r) { return r.hl; });

  var project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active project");
  var seq = await project.getActiveSequence();
  if (!seq) throw new Error("No active sequence");

  var markers = await ppro.Markers.getMarkers(seq);
  var T = ppro.Marker.MARKER_TYPE_COMMENT;
  var z = ppro.TickTime.TIME_ZERO;
  var zero = (await seq.getZeroPoint()).seconds;
  var endS = (await seq.getEndTime()).seconds;
  var zeroFrame = Math.round(zero * fps);
  // createWithSeconds truncates to a tick; 1 tick under a frame boundary shows as the
  // previous frame. Nudge a fraction of a frame past the boundary to land on the right one.
  var frameEps = 0.1 / fps;

  function tc2sec(tc) {
    var p = tc.split(":");
    return (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]) + (+p[3]) / fps;
  }

  // clear-first, or gather occupied frames for append/merge
  var cleared = 0;
  var occupied = {};
  if (clearFirst) {
    var ex = await markers.getMarkers();
    cleared = ex.length;
    if (cleared) {
      await project.lockedAccess(function () {
        project.executeTransaction(function (tx) {
          for (var i = 0; i < ex.length; i++) tx.addAction(markers.createRemoveMarkerAction(ex[i]));
        }, "TC Markers: clear");
      });
    }
  } else {
    var ex2 = await markers.getMarkers();
    for (var j = 0; j < ex2.length; j++) {
      var s = (await ex2[j].getStart()).seconds;
      occupied[Math.round(s * fps)] = true;
    }
  }

  // build deduped items
  var seen = {};
  var items = [];
  var skipRange = 0, skipDup = 0;
  for (var r = 0; r < hlRows.length; r++) {
    var posFrame = Math.round(tc2sec(hlRows[r].tc) * fps) - zeroFrame;
    if (posFrame < 0) posFrame = 0;
    var pos = posFrame / fps;            // frame-aligned seconds, relative to sequence start
    if (pos > endS) { skipRange++; continue; }
    var key = posFrame;
    if (seen[key] !== undefined) {
      var it = items[seen[key]];
      if (!it.comment) it.comment = hlRows[r].comment;
      skipDup++; continue;
    }
    if (!clearFirst && occupied[key]) { skipDup++; continue; }
    seen[key] = items.length;
    items.push({ pos: pos, name: hlRows[r].tc, comment: hlRows[r].comment || "" });
  }

  // add markers
  var added = 0;
  await project.lockedAccess(function () {
    project.executeTransaction(function (tx) {
      for (var i = 0; i < items.length; i++) {
        var tt = ppro.TickTime.createWithSeconds(items[i].pos + frameEps);
        tx.addAction(markers.createAddMarkerAction(items[i].name, T, tt, z, items[i].comment));
        added++;
      }
    }, "TC Markers: add");
  });

  // recolor the markers we just added (match by start frame)
  var want = {};
  for (var w = 0; w < items.length; w++) want[Math.round(items[w].pos * fps)] = true;
  var all = await markers.getMarkers();
  var toColor = [];
  for (var a = 0; a < all.length; a++) {
    var ss = (await all[a].getStart()).seconds;
    if (want[Math.round(ss * fps)]) toColor.push(all[a]);
  }
  var colored = 0;
  if (toColor.length) {
    await project.lockedAccess(function () {
      project.executeTransaction(function (tx) {
        for (var i = 0; i < toColor.length; i++) {
          tx.addAction(toColor[i].createSetColorByIndexAction(colorIndex));
          colored++;
        }
      }, "TC Markers: color");
    });
  }

  var after = await markers.getMarkers();
  return {
    sequence: seq.name,
    highlightedRows: hlRows.length,
    cleared: cleared,
    skippedOutOfRange: skipRange,
    skippedDuplicateFrame: skipDup,
    markersAdded: added,
    colored: colored,
    markersNow: after.length
  };
}

async function activeSequenceName() {
  var project = await ppro.Project.getActiveProject();
  if (!project) return null;
  var seq = await project.getActiveSequence();
  return seq ? seq.name : null;
}

module.exports = { applyMarkers: applyMarkers, activeSequenceName: activeSequenceName };
