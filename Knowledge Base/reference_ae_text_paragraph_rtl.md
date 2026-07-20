---
name: reference-ae-text-paragraph-rtl
description: "AE TextDocument scripting gotchas for RTL/paragraph properties (direction, justification, resetParagraphStyle) discovered building the VOD Path segment-layer fixer panel"
metadata:
  type: reference
  originSessionId: e05655e7-0c92-4bf4-b005-54c129d162e1
---

# TextDocument paragraph/RTL scripting gotchas

Confirmed on AE 26.2.1x2, building `Scripts/fix-vod-path-segment-layer.jsx` (a dockable
ScriptUI panel, installed in AE's `ScriptUI Panels` folder) that normalizes "VOD Path segment"
text layers in the `Autobus` comp — un-parent, reset scale, delete a stray scale animator,
fix paragraph alignment/direction, and apply a per-character font-styling expression. Built
by diffing a manually-fixed reference layer (Autobus layer 164) against an un-fixed sibling
(layer 156).

## `justification` is relative to READING ORDER, not the screen

`ParagraphJustification.LEFT_JUSTIFY` (7413) and `RIGHT_JUSTIFY` (7414) name the *start*/*end*
of reading order, not literal screen-left/screen-right. Once `direction` is RTL, `LEFT_JUSTIFY`
("align to the start of reading order") **visually renders as right-aligned** in the Paragraph
panel. This is counterintuitive and cost real back-and-forth: setting `RIGHT_JUSTIFY` under RTL
direction visually flips the text to LEFT-aligned — confirmed by diffing the fixed reference
layer (justification stayed `7413`/`LEFT_JUSTIFY` before AND after fixing, only `direction`
changed) against the buggy result (setting `RIGHT_JUSTIFY` + RTL visually showed left-aligned).
**Always verify against a real before/after reference pair — don't trust the enum name.**

## `direction` is a real scriptable property, no named enum

`doc.direction` exists (confirmed via `doc.reflect.properties`) and is settable, but
`TextDirection` is `undefined` in ExtendScript's global scope — no named enum is exposed.
Use raw values: `10212` = LTR (default), `10213` = RTL. Determined empirically by diffing a
before/after reference pair, not from any documented constant.

## `resetParagraphStyle()` / `resetCharStyle()` exist and reset justification+direction

Found via `doc.reflect.methods` on a `TextDocument` (`value` read from an `ADBE Text Document`
property) — not documented anywhere: `characterRange`, `composedLineCharacterIndexesAt`,
`composedLineRange`, `paragraphCharacterIndexesAt`, `paragraphRange`, `resetCharStyle`,
`resetParagraphStyle`. **`resetParagraphStyle()` resets `justification` and `direction` back
to defaults** — call it FIRST, before setting the values you actually want, not after. Setting
justification/direction then calling reset silently wipes them back to LTR/LEFT_JUSTIFY; this
was the first bug hit building the fixer script. Called as a plain statement (not reassigned) —
it appears to mutate the `doc` object in place, unlike the separate `createStyle()`-based
chainable per-character styling API (`.setFont()`/`.setFontSize()`/`.setTracking()`, which DOES
return a new value each call and must be reassigned).

## Confirmed correct fix-script order (validated live against the reference layer)

```jsx
var doc = textDocProp.value;
doc.resetParagraphStyle();                                // reset MUST come first
doc.direction = 10213;                                     // RTL
doc.justification = ParagraphJustification.LEFT_JUSTIFY;   // visually right-aligned under RTL
textDocProp.setValue(doc);
```

## Other gotchas from the same script

- **Deleting a specific Text Animator by name**: don't trust a "probably Animator N" guess —
  diff a real before/after reference pair to confirm the exact name. In this project it really
  was literally `"Animator 1"` (confirmed: the before-layer had `["Animator 1","Animator 2"]`,
  the after-layer had only `["Animator 2"]`).
- **Un-parenting a layer to normalize its scale, then restoring the parent**: capture the
  actual layer OBJECT reference (`var originalParent = layer.parent;`) before setting
  `layer.parent = null` — capturing only the parent's *name* isn't enough to restore it later.
  This was the second bug hit (the script un-parented but never restored).
- **Un-parenting + re-parenting introduces a small visual X-position shift** even though the
  parent relationship itself is restored — the layer's local transform doesn't automatically
  compensate for whatever offset the parent was contributing. Requires a manual position
  touch-up after running the fix; not something the script currently handles automatically.
- **`app.executeCommand(app.findMenuCommandId("Undo"))` does NOT reliably undo a property
  change just made via ExtendScript `setValue()` in the same script run** — confirmed: called
  it right after a `setValue()` inside `beginUndoGroup`/`endUndoGroup`, and the property value
  was unchanged afterward. Don't rely on programmatic Undo to revert a script's own test
  changes — explicitly set the values back to what you read before the change instead.

## Context

This came out of the Autobus "VOD Path" cleanup during the broader Channel Selection
unification project (see `project_channel_selection_unification.md`) — the segmented
multi-layer Hebrew/English text trick (`Master text` + per-segment layers each pulling
character-range styling via expression from `privateControls` sliders) is the same rig
audited there. The fixer script/panel lives at
`adobe-dev/Scripts/fix-vod-path-segment-layer.jsx` and is installed in AE's own
`ScriptUI Panels` folder for direct use (Window > fix-vod-path-segment-layer.jsx).
