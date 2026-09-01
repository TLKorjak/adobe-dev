---
name: AE Expression Knowledge Base
description: Reusable After Effects expressions we've built and validated. Each entry: purpose, expression, notes/gotchas.
type: reference
originSessionId: 4be71d4c-d8d9-4e67-a271-f151b19502e2
modified: 2026-09-01T12:47:38.449Z
---
# AE Expression Knowledge Base

A growing collection of AE expressions we've authored and confirmed working. Add new entries here when an expression is validated in the timeline. (Auto-mirrored to `adobe-dev/Knowledge Base/` so it travels with the repo.)

---

## Vertically auto-center a text layer's Anchor Point to its own rendered bounds

**Target property:** Text layer → Anchor Point
**Purpose:** Keep a text block vertically centered on its Position regardless of how many lines actually render (e.g. paired with a "clamp to N lines" Source Text expression) — no manual re-centering needed each time line count changes.

```javascript
var rect = thisLayer.sourceRectAtTime(time, false);
[value[0], rect.top + rect.height / 2, value[2]];
```

For a layer that is **not** 3D-enabled, drop the third element instead — Anchor Point is only `[x, y]` on a 2D layer:

```javascript
var rect = thisLayer.sourceRectAtTime(time, false);
[value[0], rect.top + rect.height / 2];
```

**Notes:**
- **Confirmed bug if you get this wrong:** using the 3-element version on a 2D layer throws `"Undefined value used in expression (could be an out of range array subscript?)"` — `value[2]` doesn't exist on a 2-element array. If unsure whether a layer is 3D, branch on `value.length` instead of hardcoding one form: `value.length > 2 ? [value[0], rect.top + rect.height/2, value[2]] : [value[0], rect.top + rect.height/2]`.
- Only adjusts Y — X (`value[0]`) is left untouched, since this trick is specifically for vertical centering. Adapt symmetrically (`rect.left + rect.width/2`) if horizontal centering is also needed.
- Safe to use even when a per-character/per-line Text Animator offsets some characters horizontally for a reveal/slide effect (confirmed on "slide by line left right", comp "Card Half 05") — `rect.top`/`rect.height` (vertical bounds) aren't affected by a purely-horizontal per-character offset.
- If the layer's own Source Text is itself expression-driven (e.g. a line-count clamp), do NOT add a same-frame time offset like `time - thisComp.frameDuration` to try to dodge a suspected same-frame race condition — that instead risks sampling a time **before the layer's own `inPoint`**, where `sourceRectAtTime` returns a degenerate/undefined rect and throws the same "undefined value" error for a different reason. Sample at plain `time`.
- **Scripted reads of `.expressionError` on this property can be badly stale** — after fixing a real bug, repeated script-side reads kept returning the exact same byte-for-byte old error message even after rewriting the expression, toggling `expressionEnabled` off/on, and nudging `comp.time`. Verify a fix in the actual AE UI, not via a scripted re-read.
- Root project/history: [[project-animation-kit-rigging]].

---

## Word count that survives a blank leading (or trailing) line

**Target property:** Slider Control driven by a text layer's word count (e.g. "Word count" on a `controls` layer), or any expression computing word count from Source Text.
**Purpose:** Correctly counts words even when the top (or bottom) line of a multi-line Source Text is blank — a plain `split(/\s+/)` gives a wrong result (often `0`) in that case.

```javascript
txt = "" + text.sourceText;
trimmed = txt.replace(/^\s+|\s+$/g, "");
trimmed == "" ? 0 : trimmed.split(/\s+/).length;
```

**Notes:**
- **Root cause:** `text.sourceText` for a blank first line is a string that *starts* with a hard-return character (`\r`) before the real content. Splitting a string that starts with whitespace via `split(/\s+/)` produces a **leading empty-string element** — so a naive check like `res[0] == "" ? 0 : res.length` misfires as "empty" whenever the top line is blank, even though real words follow on later lines.
- Fix: trim leading/trailing whitespace (including line breaks) from the full string **before** checking emptiness or splitting, so the emptiness check reflects actual content, not just "does it start with a line break."
- Validated on two separate comps/rigs: originally on "Two Lines Title", reused successfully on "Vertical_ 3 lines Title" (2026-08-11) — same fix, same root cause, different comp.
- Related to but distinct from the [[ae-hebrew-english-line-highlight-bug]] direction fix — that one is about the **Lines-based Range Selector** miscounting with bidi text; this one is about **word-counting from a plain split** miscounting due to a leading line break. Both can show up together on the same "blank top line" text but are separate bugs with separate fixes.

---

## Limit Source Text to N lines (style-preserving)

**Target property:** Text layer → Source Text
**Purpose:** Truncates the text to its first N lines (here 2); extra lines are dropped. Preserves the layer's font/styling.

```javascript
var s = text.sourceText;
var lines = ("" + s).split(/[\r\n]/);   // hard returns + Shift+Enter soft breaks
lines.length > 2 ? s.createStyle().setText(lines.slice(0, 2).join("\r")) : s;
```

**Notes:**
- AE Source Text uses `\r` (carriage return) as the hard line break, not `\n`. `` is the **soft** break (Shift+Enter). Word-wrap in paragraph/box text produces **no** break character, so this string-counting approach can't limit wrapped lines — it only counts explicit breaks.
- **GOTCHA (verified AE 26.3, 2026-06-24): the receiver MUST be `text.sourceText`, NOT `value`.** `text.sourceText.createStyle().setText(...)` truncates correctly; `value.createStyle().setText(...)` **silently no-ops** (text stays full, no error). `getStyleAt(0,0).setText(...)` also no-ops.
- **Do NOT return a plain string** (e.g. `lines.slice(0,2).join("\r")`): a string output rebuilds the text with a DEFAULT font, so non-default fonts (e.g. Hebrew `yes-DisplayRegular`) render as nothing — the text appears to vanish. Returning `text.sourceText`/`createStyle()` keeps the font.
- `createStyle().setText(...)` returns a `TextDocument`, so the expression value is valid Source Text; the else-branch returns `text.sourceText` unchanged so styling is preserved when no truncation is needed.
- It only clamps the **rendered** output — you can still type more lines in edit mode; it collapses on deselect.
- Scripting can't verify this: `Property.value` / `valueAtTime(t,false)` and `sourceRectAtTime` do **not** reflect Source-Text-expression output. Verified by reading `valueAtTime` on a throwaway layer per-candidate.
- Change both `2`s for a different line count. First applied 2026-05-11 to "name + description 01" in "Two Lines Title Awards"; corrected/verified form 2026-06-24.

---

## Dropdown Menu Control — read selected item's TEXT directly (no index mapping needed)

**Target property:** Any layer whose visibility/behavior should switch based on a Dropdown Menu Control's selected item.
**Purpose:** Drive layer opacity (as an Enabled/visibility stand-in) by comparing the dropdown's selected **name**, not its numeric index — so reordering, adding, or removing dropdown items never breaks anything downstream.

```javascript
ddm = thisComp.layer("controls").effect("Title Animations")("Menu").text;
ddm == "Kerning" ? 100 : 0
```

---

## Source Text: font/align/per-char-size + auto RTL/LTR direction fix for mixed Hebrew+English/digit lines

**Target property:** Text layer → Source Text
**Purpose:** Combined rig — pulls font choice, alignment, and base size from `controls` slider/menu effects; per-character-resizes English letters (caps vs lowercase) via `privateControls` sliders; and fixes AE's native **Based On: Lines** Range Selector miscount when a line mixes Hebrew (RTL) with English letters or digits (LTR), by force-switching paragraph `direction` to LTR for mixed content — with a compensating swap on the Align option mapping so on-screen Left/Right stays consistent either way.

```javascript
var ctrl = thisComp.layer("controls");
var src  = ctrl.text.sourceText;
// --- Font selection ---
var fontIdx = ctrl.effect("Font Selection")("Menu");
var fonts = ["yes-DisplayRegular", "FbAlfi-Medium", "SimplerPro_V3-Bold"];
var font  = fonts[Math.max(0, Math.min(fonts.length - 1, fontIdx - 1))];

var s = "" + src;
var hasHebrew = /[֐-׿]/.test(s);
var hasLatin = /[A-Za-z0-9]/.test(s);
var isMixed = hasHebrew && hasLatin;

// --- Alignment ---
var d = ctrl.effect("Align")("Menu");
// under the LTR override (mixed text), justification is relative to reading order,
// so Left/Right swap visually vs. the default RTL case — swap here to compensate
var options = isMixed
  ? ["alignRight", "alignCenter", "alignLeft"]
  : ["alignLeft", "alignCenter", "alignRight"];
var j = options[clamp(d - 1, 0, 2)];

// base size for ALL chars first (createStyle starts empty; unsized chars would render at 0 and vanish)
var baseSize = (fontIdx == 2) ? 300 : (src.fontSize || 420);
// --- Apply (order matters: setText before setJustification) ---
var styled = src.createStyle()
  .setFont(font)
  .setText(s)
  .setFontSize(baseSize)
  .setJustification(j);
// English letters: UPPERCASE -> caps slider, lowercase -> slider. Hebrew keeps base size.
var enSizeLower = thisComp.layer("privateControls").effect("english font size")("Slider");
var enSizeCaps  = thisComp.layer("privateControls").effect("english font size caps")("Slider");
var enTracking  = thisComp.layer("privateControls").effect("english tracking")("Slider");
for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) {
        styled = styled.setFontSize(enSizeCaps, i, 1).setTracking(enTracking, i, 1);
    } else if (c >= 97 && c <= 122) {
        styled = styled.setFontSize(enSizeLower, i, 1).setTracking(enTracking, i, 1);
    }
}
styled = styled.setDirection(isMixed ? "left-to-right" : "right-to-left");
styled;
```

**Notes:**
- **Regex must include digits**, not just Latin letters: `/[A-Za-z0-9]/`. A letters-only class (`/[A-Za-z]/`) silently fails to detect a Hebrew+numeral line (e.g. `"111"` over `"שתי שורות"`) since digits aren't letters — but digits are still LTR under Unicode bidi rules and trigger the same Lines-based Range Selector miscount as English letters would.
- `setDirection()` only accepts the literal strings `"left-to-right"` / `"right-to-left"` — not enum names, not numeric codes (see [[reference-ae-pseudo-dropdown]] history / [[reference-ae-text-paragraph-rtl]] for the equivalent scripting-side enum values `10212`/`10213`).
- The Align swap is necessary because `setJustification` is relative to reading order, not the screen (per [[reference-ae-text-paragraph-rtl]]) — flipping direction for mixed text flips which physical side "alignLeft"/"alignRight" render on unless compensated.
- Fixes the long-standing TODO in [[ae-hebrew-english-line-highlight-bug]] (now resolved) where mixed Hebrew+English/digit lines broke the "highlight line" color-animator Range Selector.
- Validated 2026-08-11 on "Two Lines Title" → layer "2 lines down up", both pure-Hebrew and mixed Hebrew+digit text, all three Align states.

**Notes:**
- `effect("Name")("Menu").text` returns the selected item's **string**, not just `.value` (the numeric index). This works directly on a Dropdown Menu Control effect — no markers, no lookup array, no separate data layer needed.
- Corrects earlier assumption (this session, 2026-08-11) that dropdown item text wasn't expression-accessible and required a marker- or text-layer-based index→name relay. That workaround is unnecessary — `.text` is the direct path.
- Because the comparison is by name, the dropdown's item list can be freely reordered/edited in the Effect Controls UI (or via `setPropertyParameters`, see [[reference-ae-pseudo-dropdown]]) without touching any layer's expression, as long as the compared string still matches an existing item.
- Used to toggle animation-variant layers on/off (e.g. "Kerning" vs other title animation options) in the new animation kit rigging work ([[project-animation-kit-rigging]]).

---

## Shape width/height follows a text layer (+ padding), collapse to 0 when empty

**Target property:** Shape layer → Contents → Rectangle 1 → Rectangle Path 1 → **Size**
**Purpose:** A rectangle (background/matte band) whose Size tracks a text layer's rendered bounds + a fixed padding; width 0 (or height 0) when the text is empty.

```javascript
// WIDTH follows text (height untouched). Use [value[0], h + PAD] for HEIGHT-follows instead.
var txt = thisComp.layer("TEXT1");
var s = "" + txt.text.sourceText;
var PAD = 103.489;   // bake = current shapeSize - current textComp size (preserves look). total padding (both sides)
var w = (s.length === 0) ? 0 : (txt.sourceRectAtTime(time, false).width * txt.transform.scale[0] / 100 + PAD);
[w, value[1]];
```

**Notes:**
- `sourceRectAtTime` is the text's *local* bounds; multiply by `txt.transform.scale` to get comp-space size.
- Bake `PAD` from the live current state so it's a **no-op at the current text** and only diverges when the text grows.
- For height-follows (matte under a title), use `[value[0], h + PAD]` reading `.height`.
- Empty check via `("" + txt.text.sourceText).length === 0` (works through a Source-Text source-link expression too — reads the live sourced text).
- Validated 2026-06-29 (SPECIAL TICKER: Shape 1/TEXT1; Vertical_Two Lines mattes).

---

## Pin one edge so a shape grows from the opposite side

**Target property:** Shape layer → Contents → Rectangle 1 → Transform → **Position** (`ADBE Vector Position`), i.e. the rectangle group's position *inside* the layer (NOT the layer Position).
**Purpose:** Keep one edge of a rectangle fixed while its Size changes, so it grows toward the other side. Pairs with the Size expression above. Stays in **layer space**, so the layer's own Position is free (no coupling to layer/parent animation).

```javascript
// RIGHT edge pinned -> grows LEFT. (rect centered on its Position; rightEdge = pos.x + size/2)
var sz = content("Rectangle 1").content("Rectangle Path 1").size;
var RIGHT = 594;            // bake = current groupPos.x + size[0]/2 (rect right edge, layer space)
[RIGHT - sz[0] / 2, value[1]];
```
```javascript
// TOP edge pinned -> grows DOWN. PATHY = the Rectangle Path's static Position.y.
var sz = content("Rectangle 1").content("Rectangle Path 1").size;
var TOP = -83;              // bake = current rect top edge in layer space (groupPos.y + pathY - height/2)
var PATHY = 14;
[value[0], TOP + sz[1] / 2 - PATHY];
```

**Notes:**
- `TOP`/`RIGHT` are **fixed design constants** — bake from a known/resting state, NOT from a currently-grown size (else the reference is wrong).
- Because it works in layer space, the layer Position can stay static or be driven separately — used to keep a matte's layer position **static (immune to the matted text's position animation)** while the rect still grows to cover added lines.
- Validated 2026-06-29 (Vertical_Two Lines: big/small lower matte = top-pinned grow-down; SPECIAL TICKER Shape 1 = right-pinned grow-left).

---

## Glue a shape's edge to a neighbor's edge (push-chain)

**Target property:** Shape layer → **Position** (the layer transform position).
**Purpose:** Make Shape B's right edge stay flush to Shape A's left edge, so B is pushed as A expands. (Shape A's right edge is pinned in its own layer; both have the right-pinned Size/group-pos expressions above.)

```javascript
// Shape B layer Position: right edge glued to Shape A's LEFT edge.
var s1 = thisComp.layer("Shape 1");
var s1Left = s1.transform.position[0] - s1.content("Rectangle 1").content("Rectangle Path 1").size[0] * s1.transform.scale[0] / 100;
var GAP = 0.204;            // bake = current B.pos.x - s1Left
[s1Left + GAP, value[1]];
```
```javascript
// A text that rides inside Shape B: follow B's right edge at a fixed offset.
var OFF = 43.177;           // bake = B.pos.x - thisText.pos.x
[thisComp.layer("Shape 2").transform.position[0] - OFF, value[1]];
```

**Notes:**
- No dependency cycle: B.pos ← A.left ← A.width ← textA; B.width ← textB; textB.pos ← B.pos. `sourceRect` is independent of position.
- Validated 2026-06-29 (SPECIAL TICKER Shape 2/TEXT2 glued to Shape 1).

---

## Pin a text's baseline / bottom while it grows (point text)

**Target property:** Text layer → **Position**
**Purpose:** Keep the bottom edge (≈ last-line baseline + descender) of a point-text layer fixed at a comp Y; added lines grow the block **upward**.

```javascript
var sr = sourceRectAtTime(time, false);
var bottomLayer = sr.top + sr.height;        // layer-space bottom edge
var BOTTOM = 922.94;                          // comp Y to pin the bottom to (bake current, or a slider)
[value[0], BOTTOM - (bottomLayer - anchorPoint[1]) * scale[1] / 100];
```

**Notes:**
- Point text adds lines downward (top fixed), so `sr.height` grows; this shifts Position up to hold the bottom.
- For a point text, the first-line baseline already sits at the anchor origin (layer y=0) — if you only want the FIRST line fixed with no expression, just keep anchor Y = 0 and don't move Position.
- `BOTTOM` can be a slider (`thisComp.layer("private controls").effect("...")("Slider")`) for art-directable placement.
- Validated 2026-06-29 (Vertical_Two/3-lines: small txt top, big text top — driven by "top/bottom title offset" sliders).

---

## Scale a position keyframe's START by line count (cap N)

**Target property:** Text layer → **Position** (transform), OR Text → Animators → Animator 1 → **Position** (`ADBE Text Position 3D`).
**Purpose:** A text that animates in (key1 = off-screen start, key2 = resting). Make the START offset grow with the line count (taller text starts proportionally further), capped at N lines, **without** touching the resting keyframe or the easing.

```javascript
// transform-Position variant (key-based slide-in)
var endY = key(2).value[1];                 // resting Y
var span = key(1).value[1] - endY;          // base start->rest slide
var raw = "" + thisLayer.text.sourceText;
var trimmed = raw.replace(/[\r]+$/, "");
var lines = (trimmed.length === 0) ? 1 : trimmed.split(/[\r]/).length;
var capped = Math.min(lines, 3);
var LEADING = 160;                           // px per line (match the text's leading)
var extra = (capped - 1) * LEADING;
var p = clamp((value[1] - endY) / span, 0, 1);  // 1 at start, 0 from rest onward -> entrance only
add(value, [0, p * extra]);
```
For a **text-animator** Position (3D), the keys live on `ADBE Text Position 3D`; same body but return `add(value, [0, p * extra, 0])`.

**Notes:**
- `clamp(p,0,1)` confines the offset to the entrance (key1→key2); rest/hold/exit keys read p=0 → untouched. Works for 2-key and 4-key (with exit) setups.
- `p` is derived from the keyframed `value`, so it follows the **original easing** automatically.
- Line counting reads `thisLayer.text.sourceText` — works even when Source Text is source-linked (reads the live sourced text). Strip trailing `\r`/`` before splitting.
- Mid-script `setValue` text edits aren't seen by the expression in the same run (caching) — verify with the text already at the target line count, or live.
- Validated 2026-06-29 (Vertical_Two Lines: big text bottom transform Position @2 lines=1306; small txt bottom Animator 1 Position).

---

## Null as a global "second position" offset (additive, no parenting)

**Target property:** every group layer → **Position** (and split X/Y for separated-dim layers).
**Purpose:** Move/keyframe a whole block of layers together via a control null, WITHOUT parenting — so each layer's own position expressions/keyframes/animators keep working (parenting reinterprets comp-space expressions/keyframes relative to the parent and breaks them).

```javascript
// Static or keyframed layer (combined Position):
add(value, thisComp.layer("Null position").transform.position - [540, 960, 0]);
```
```javascript
// Layer that already has a Position expression: wrap its result.
var base = /* ...existing computed [x,y]... */;
add(base, thisComp.layer("Null position").transform.position - [540, 960, 0]);
```
```javascript
// Separated-dimension layer (combined Position is locked/hidden): set X and Y individually.
// ADBE Position_0 (X):
value + (thisComp.layer("Null position").transform.position[0] - 540);
// ADBE Position_1 (Y):
value + (thisComp.layer("Null position").transform.position[1] - 960);
```

**Notes:**
- `- [540,960,0]` is the null's **rest/center**, so it's a no-op while the null sits there; move it to offset the group.
- **Parented children:** if layer B is parented to layer A and A is in the group, add the offset to **A only** — B inherits via parenting; offsetting B too double-applies.
- **Separated dimensions** (`pos.dimensionsSeparated`, common on 3D layers): the combined `ADBE Position` can't take an expression ("property is hidden" error, `canSetExpression=false`) — set `ADBE Position_0`/`_1` instead. Reading the combined `.value` does NOT reflect sub-property expressions; verify by reading `Position_0/_1.value`.
- Don't ALSO parent the layers to the null — the expression is the link.
- References the null **by name** — renaming the null breaks it.
- Validated 2026-06-29 (Vertical_Two Lines title group; Vertical_ 3 lines Title block 4-12 incl. parented child + separated 3D layers, all shift by the null delta).

---

## Merge per-character English styling into an existing line-limit Source Text expression

**Target property:** Text layer → **Source Text**
**Purpose:** Combine two independent techniques on one layer: (1) truncate to a max line count (pre-existing), (2) apply per-character font/size/tracking overrides so English letters render in a different font/size than the Hebrew base text — uppercase and lowercase get their own size slider, Hebrew keeps the base size.

```javascript
// PREFER reading src from a separate helper layer over self-reference — see Essential Properties note below
var src = thisComp.layer("show name source text").text.sourceText;
var limit = thisComp.layer("private controls").effect("lines limit")("Slider");
var lines = ("" + src).split(/[\r\n]/);   // hard returns + Shift+Enter soft breaks
var s = lines.length > limit ? lines.slice(0, limit).join("\r") : ("" + src);

// base size for ALL chars first (createStyle starts empty; unsized chars would render at 0 and vanish)
var baseSize = src.fontSize || 220;
var styled = src.createStyle().setText(s).setFontSize(baseSize);
// English letters: UPPERCASE -> caps slider, lowercase -> slider. Hebrew keeps base size.
var enSizeLower = thisComp.layer("private controls").effect("english font size")("Slider");
var enSizeCaps  = thisComp.layer("private controls").effect("english font size caps")("Slider");
var enTracking  = thisComp.layer("private controls").effect("english tracking")("Slider");
for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) {
        styled = styled.setFont("Montserrat-Regular", i, 1).setFontSize(enSizeCaps, i, 1).setTracking(enTracking, i, 1);
    } else if (c >= 97 && c <= 122) {
        styled = styled.setFont("Montserrat-Regular", i, 1).setFontSize(enSizeLower, i, 1).setTracking(enTracking, i, 1);
    }
}
styled;
```

**Notes:**
- **Essential Properties + Source Text SELF-reference — prefer a helper layer (confirmed 2026-08-02).** A Source Text expression that reads its OWN text via `var src = text.sourceText;` is not inherently wrong, but in at least one real case it evaluated incorrectly when the comp was nested and the text driven via **Essential Properties** (instance rendered ~31% larger than the master; correct inside the comp). Moving the editable text to a **separate helper layer** — e.g. `"show name source text"` — exposing THAT layer's Source Text to the Essential Graphics panel, and reading it cross-layer (`var src = thisComp.layer("show name source text").text.sourceText;`) made master and instances behave identically. Self-reference doesn't *have* to be avoided, but the helper-layer split is preferable for anything that will be driven through Essential Properties, to sidestep this class of issue. (An earlier attempted fix — hardcoding `baseSize` instead of `src.fontSize || 220` — was NOT sufficient on its own, though a constant/slider `baseSize` is still the right pattern; the `src.fontSize` self-read also evaluates as 0/falsy in-master, so never derive baseSize from the source document either way.)
- Order matters: compute the (possibly truncated) `s` FIRST, then build the per-character styled object FROM `s` — so the for-loop's character indices match the truncated string, not the original untruncated text.
- Adapt effect/layer names to the CURRENT comp's actual naming — this expression template gets reused across comps with inconsistent conventions (`"privateControls"` vs `"private controls"` with a space; the helper source layer's name also varies per comp: `"Master text"`, `"Show Name"`, `"show name source text"`).
- Validated 2026-07-20 ("show name" in "Vertical_End Frame"); Essential-Properties fix validated 2026-08-02 (same layer, driven from comp "test").

---

## Fill only ONE word among repeated instances, via Text Animator Range Selector "Subtract" mode (no expression needed)

**Target property:** Text layer → Text Animators → (new animator) → **Fill Opacity**, with its **Range Selector → Advanced**
**Purpose:** A single text layer holds one word repeated N times (e.g. via the per-character-tracking repeat technique above, spread both sides via center justification). Give ONE specific instance (typically the center one) a solid fill while all other repeated instances render fill-less/stroke-only — all within one layer, no per-character `createStyle()` fill toggling (AE's per-character style API has no fill on/off toggle, only fill *color*, so this can't be done via the Source Text expression itself).

**Recipe (UI, not an expression):**
1. Add a Text Animator to the layer. Set its **Fill Opacity** property to **0**.
2. On that animator's Range Selector → Advanced: set **Based On = Words**, **Units = Index**.
3. Set **Index Start / Index End** to bracket the ONE word to keep filled (0-indexed across the repeated words — e.g. for 5 repeats, index 2 is the center/3rd word).
4. Set **Mode = Subtract**.

**Notes:**
- **The trick is Mode = Subtract.** Normally a Range Selector applies its animator property TO the selected range. Subtract mode inverts that: the property (here, Fill Opacity = 0) applies to the COMPLEMENT of the selection — i.e. to every word EXCEPT the one selected. The selected word is left untouched, defaulting back to Fill Opacity = 100 (fully filled), while every other repeated instance gets Fill Opacity = 0 (fill invisible; Stroke Opacity is untouched, so a stroke-enabled layer still shows hollow/outlined letters for the non-selected repeats).
- Matches (in a single layer) what would otherwise require a multi-layer setup: one filled "hero" word layer + separate stroke-only duplicate layers.
- `Based On: Words` + `Units: Index` is what makes the selector address whole repeated-word instances rather than characters or a percentage span — required since the repeats are separated by spaces within one string.
- Works together with (not instead of) the document-level `applyFill`/`applyStroke` — the base document should have BOTH fill and stroke enabled; the animator's Fill Opacity=0 (via Subtract) is what selectively hides fill on the non-center instances, not the document-level toggle (which would affect all instances uniformly — that's the wrong tool for a per-instance result).
- Discovered/validated 2026-08-10 (layer "Text 3", comp "slide title" — 5-repeat centered-spread word, per-character-tracking gap technique from the entry above, center word index 2 kept filled).

---

## Stable anchor for mixed Hebrew/English per-character-sized text (avoid sourceRectAtTime height instability)

**Target property:** Text layer → **Anchor Point**
**Purpose:** Keep a text layer's anchor — and therefore its resting on-screen position — stable when per-character font-size overrides (e.g. English letters at a different size than the Hebrew base, see the expression above) change the rendered bounding box height. A naive `sourceRectAtTime`-based anchor shifts every time the Hebrew/English mix changes, even with no other edits to the layer.

```javascript
// Anchor Y = top edge + a baked per-line height, NOT the raw dynamic bounding-box height.
// r.height fluctuates with per-character font-size mixing (English vs Hebrew); line count doesn't.
var BASE_LINE_HEIGHT = 155.540010537952; // baked: single-line height measured with base-size-only text
var LEADING = 200;                        // baked: Character panel leading value (autoLeading must be OFF)
var s = "" + text.sourceText;
var numLines = s.split(/[\r\n]/).length;
var r = sourceRectAtTime(time, false);
[ r.left + r.width/2, r.top + BASE_LINE_HEIGHT + (numLines - 1) * LEADING ];
```

**Notes:**
- **Root cause:** an anchor expression like `[r.left + r.width/2, r.top + r.height]` (bottom-edge tracking) recomputes every time the rendered glyphs' size changes — mixing in per-character overrides (e.g. English letters styled smaller/larger via a different font/slider than the Hebrew base) changes `r.height`, moving the anchor even though the line count and Position expression haven't changed. A keyframe-based Position expression is often a no-op AT REST (see "Scale a position keyframe's START by line count" above — `p=0` once fully rested), so nothing compensates for this drift and the whole layer visibly shifts.
- **Fix:** replace the dynamic `r.height` with `BASE_LINE_HEIGHT + (numLines - 1) * LEADING` — depends only on LINE COUNT (from a manual `\r`/`\n`/`` split, same pattern as the line-limit expression), never on which specific characters/sizes are on each line.
- `BASE_LINE_HEIGHT` must be baked from the CURRENT single-line height (read via `sourceRectAtTime` with base-size-only text) so the fix is an exact no-op for existing single-line content — using `LEADING` alone for the first line too would cause a visible jump, since `leading` (the line-box height, includes extra spacing) is NOT the same as the tight glyph bounding-box height `sourceRectAtTime` reports (200 vs ~155.5 in this case).
- **GOTCHA: `.leading` is NOT accessible on the expression-dialect `text.sourceText` object**, even though it works fine via full ExtendScript (`textDocProp.value.leading` from a script, outside an expression). Using `text.sourceText.leading` inside an expression throws `"couldn't turn result into numeric value"` and disables the expression — and the failure can look deceptively subtle: `.value` may still return a stale/last-good number even while `expressionError` is non-empty, so always check `expressionError` explicitly rather than trusting `.value` looking "fine". Hardcode the confirmed numeric leading value as a constant instead.
- Residual caveat, not fully resolved: `r.top` itself is still read live and could theoretically shift slightly if an English capital renders with a notably different ascent than Hebrew's natural cap-height at the configured sizes — a much smaller effect than the height-driven shift this fixes, but not yet confirmed negligible in practice.
- Validated 2026-07-20 ("show name" in "Vertical_End Frame") — before/after anchor values matched to floating-point precision for the current (Hebrew-only, single-line) text, confirming zero visual jump from applying this fix.
