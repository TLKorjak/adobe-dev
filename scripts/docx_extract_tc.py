#!/usr/bin/env python3
"""Extract timecode rows + highlighted-sync flags from a transcript .docx.

Usage:
    python3 docx_extract_tc.py rivlin_transcript_selected_syncs.docx > rows.json

Output: JSON array of {tc, hl, comment} in document order, where
    tc      = "HH:MM:SS:FF" from the table's tc column (one per block)
    hl      = True if any run in that tc block is highlighted yellow
    comment = first 5 words of that block's highlighted text ("" if none)

DOCX highlights are explicit XML — no rendering. Word's highlighter pen emits
<w:highlight w:val="yellow"/>; Google Docs export uses <w:shd w:fill="FFFF00"/>.
Both are detected. Validated against rivlin_transcript_selected_syncs.docx:
216 tc rows, 44 highlighted.
"""
import sys, re, json, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
TC = re.compile(r'^\d{2}:\d{2}:\d{2}:\d{2}$')
YELLOW_FILLS = {'FFFF00', 'FFFE00', 'FFFF99'}  # common yellow shading hexes


def run_is_highlighted(r):
    rpr = r.find(W + 'rPr')
    if rpr is None:
        return False
    h = rpr.find(W + 'highlight')
    if h is not None and h.get(W + 'val') == 'yellow':
        return True
    shd = rpr.find(W + 'shd')
    if shd is not None and (shd.get(W + 'fill') or '').upper() in YELLOW_FILLS:
        return True
    return False


def run_text(r):
    return ''.join(t.text or '' for t in r.iter(W + 't'))


def cell_text(c):
    return ''.join(t.text or '' for t in c.iter(W + 't')).strip()


def cell_hl_text(c):
    return ''.join(run_text(r) for r in c.iter(W + 'r') if run_is_highlighted(r))


def first5(s):
    return ' '.join([w for w in re.split(r'\s+', s.strip()) if w][:5])


def extract(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)

    cur = None
    order = []
    hltext = {}
    for tbl in root.iter(W + 'tbl'):
        for tr in tbl.iter(W + 'tr'):
            cells = tr.findall(W + 'tc')
            if not cells:
                continue
            tc_here = None
            for c in cells:
                if TC.match(cell_text(c)):
                    tc_here = cell_text(c)
            if tc_here:
                cur = tc_here
                if cur not in hltext:
                    order.append(cur)
                    hltext[cur] = ''
            for c in cells:
                ht = cell_hl_text(c)
                if ht and cur:
                    hltext[cur] += ht

    rows = []
    for tc in order:
        ht = hltext[tc].strip()
        rows.append({'tc': tc, 'hl': bool(ht), 'comment': first5(ht) if ht else ''})
    return rows


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: docx_extract_tc.py <file.docx>')
    print(json.dumps(extract(sys.argv[1]), ensure_ascii=False))
