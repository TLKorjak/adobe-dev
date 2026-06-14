// docxParse.js — extract timecode rows + highlighted-sync info from a DOCX's
// word/document.xml. Pure string/regex (no DOM, no rendering). Mirrors
// scripts/docx_extract_tc.py. Validated: rivlin DOCX -> 216 tc, 44 highlighted.
//
// Assumes a simple (non-nested) transcript table, which is how these
// transcripts are produced.

var TC = /^\d{2}:\d{2}:\d{2}:\d{2}$/;
var YELLOW_FILLS = { FFFF00: 1, FFFE00: 1, FFFF99: 1 };

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(parseInt(d, 10)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&amp;/g, "&");
}

// concat all <w:t> text within an XML fragment
function textOf(frag) {
  var s = "";
  var re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  var m;
  while ((m = re.exec(frag))) s += m[1];
  return decodeEntities(s);
}

function runIsHighlighted(runXml) {
  if (/<w:highlight\b[^>]*w:val="yellow"/.test(runXml)) return true;
  var sh = /<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(runXml);
  if (sh && YELLOW_FILLS[sh[1].toUpperCase()]) return true;
  return false;
}

function first5(s) {
  var w = s.trim().split(/\s+/);
  var out = [];
  for (var i = 0; i < w.length && out.length < 5; i++) if (w[i]) out.push(w[i]);
  return out.join(" ");
}

// xml: word/document.xml as a string -> [{tc, hl, comment}] in document order
function parseDocxXml(xml) {
  var rows = xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  var cur = null;
  var order = [];
  var hl = {};
  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    var tcHere = null;
    for (var c = 0; c < cells.length; c++) {
      var t = textOf(cells[c]).trim();
      if (TC.test(t)) tcHere = t;
    }
    if (tcHere) {
      cur = tcHere;
      if (!(cur in hl)) { order.push(cur); hl[cur] = ""; }
    }
    if (cur) {
      var acc = "";
      for (var cc = 0; cc < cells.length; cc++) {
        var runs = cells[cc].match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
        for (var r = 0; r < runs.length; r++) {
          if (runIsHighlighted(runs[r])) acc += textOf(runs[r]);
        }
      }
      if (acc) hl[cur] += acc;
    }
  }
  var out = [];
  for (var k = 0; k < order.length; k++) {
    var tc = order[k];
    var h = (hl[tc] || "").trim();
    out.push({ tc: tc, hl: !!h, comment: h ? first5(h) : "" });
  }
  return out;
}

function summarize(rows) {
  var hlRows = rows.filter(function (r) { return r.hl; });
  return {
    total: rows.length,
    highlighted: hlRows.length,
    first: rows.length ? rows[0].tc : null,
    last: rows.length ? rows[rows.length - 1].tc : null
  };
}

module.exports = { parseDocxXml: parseDocxXml, summarize: summarize };
