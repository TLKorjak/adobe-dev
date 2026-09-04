# Plan: Channel Selection Dropdown Unification

In-progress multi-comp project — unifying the "Channel Selection" dropdown item list
(order + a couple deletions) across ~11 comps and rewiring every dependent expression.
Status/methodology/gotchas below.

**Goal:** all comps with a "Channel Selection" Dropdown Menu Control effect (AE, project
`yes-promo-kit`) should end up with the identical unified item list, and every expression
that hardcodes an index into that list should be remapped so behavior is unchanged.
Reordering + a couple deletions only — no renaming (label typos are normalized to the
unified spelling, which the user does NOT consider "renaming").

## The unified target list (13 items, order matters)
```
1 MOVIES DRAMA   5 TV DRAMA    9  YES + CINEMA   13 YES PLUS
2 MOVIES ACTION  6 TV ACTION   10 YES + DIAMONDS
3 MOVIES COMEDY  7 TV COMEDY   11 VOD
4 MOVIES KIDS    8 DOCU        12 VOD KIDS
```
Deleted everywhere: any separator placeholder, `GENERAL YES`/`GENERAL yes`/`YES GENERAL`
variants, `YES VOD` (Tag's stale duplicate — plain `VOD` is the one kept), `VOD LONDON`,
`ISRAELI`. Normalized (not counted as "renaming"): `CINEMA`→`YES + CINEMA`,
`DISMONDS`→`YES + DIAMONDS`, `yes+ CINEMA`/`yes+ DIAMONDS`→ same unified labels.

## Scope: 8 host comps + 5 nested/cross-comp precomps (13 total, found via project-wide scan — see below)
| Host comp | Deletions needed | Additions needed | Nested precomp(s) that ALSO reference its "Channel Selection" |
|---|---|---|---|
| Autobus | separator, YES GENERAL | YES PLUS | — — **DONE, see below** (also had 2 sibling dropdowns rewired: VOD Path, VOD Kids Path) |
| End Frame | separator, GENERAL YES | — (has YES PLUS) | — — **DONE, see below** (also had `VOD Path` + `VOD KIDS Path` rewired; discovered `TIMELINE Premiere` cross-references End Frame's Channel Selection directly) |
| Intro | separator, GENERAL YES | — (has YES PLUS) | `Yes VOD intro` (7 refs, all `comp("Intro")`) — **DONE, see below**; `INTRO VOD` (1 ref, currently dangling — see Open Questions) |
| Tag | GENERAL YES, YES VOD (dup) | YES PLUS | `Vertical_Tag` (4 refs, all `comp("Tag")`, same layer "Tag_00022.png") — **DONE, see below** |
| Vertical_End Frame | VOD LONDON, GENERAL yes, ISRAELI, separator (4 deletions — most of any comp) | YES PLUS | `_MESSAGING 13` (15 refs, all `comp("Vertical_End Frame")`) — **DONE, see below** |
| Vertical_Intro | separator, GENERAL YES | — (has YES PLUS) | `INTRO VOD` (shared with Intro — see Open Questions) — **DONE, see below** (also had `VOD Path` rewired) |
| Vertical_Tag | VOD LONDON, GENERAL yes, ISRAELI, yes VOD (dup) | YES PLUS | `_OUTRO tag vertical` (7 refs, all `comp("Vertical_Tag")`) — **DONE, see below**. **Previously-missed 8th host** — discovered only by scanning for `effect("Channel")` project-wide while investigating what looked like just a nested reference to Tag's dropdown; its own "controls" layer has a completely independent 16-item dropdown, already renamed to the generic "Channel" (matches the `setPropertyParameters`-resets-the-display-name gotcha — it was mutated by SOME prior script/session, not this project). Not previously listed in this scope table at all. |
| TIMELINE Premiere | GENERAL YES | YES PLUS | — |

**Critical lesson (cost real rework):** the effect-search that finds which comps "have" the
Channel Selection effect only finds the 7 HOST comps. It does NOT find comps that merely
*reference* another comp's effect via `comp("HostName").layer("controls").effect("Channel
Selection")` — those live in separate CompItems (nested precomps used as a layer, or
independently). **Always run a project-wide expression-text scan for the string "Channel
Selection" across every comp** before considering a host comp's expression audit complete
— group results by parsing each expression's `comp("X")` call (or "self" if it uses
`thisComp`/bare `effect()` and lives directly in a host comp). This is how `_MESSAGING 13`,
`Yes VOD intro`, `Vertical_Tag`, and the dangling `INTRO VOD` ref were found — none showed
up in the host-only scan.

## Methodology (confirmed with user, apply per comp)
1. **Map current state**: read the comp's current item list (`propertyParameters`), then
   project-wide-scan for every expression referencing ITS "Channel Selection" (both on its
   own layers AND in any nested/cross-comp precomp that targets it by name).
2. **Build old-index → new-index table**: match by label (post-normalization) against the
   unified list; items with no match = deleted → map to `-1` (a value the dropdown can
   never produce, so the comparison is permanently false — safer than trying to
   strip/restructure the expression). Convention set by user: deleted items' layers stay in
   the comp, just permanently invisible — do not delete layers.
3. **Apply**: `menu.setPropertyParameters(unifiedListArray)`, then rename the effect back to
   `"Channel Selection"` (see gotcha below), then remap the dropdown's *current* value to
   the new index of the same semantic item (so the live preview doesn't visibly jump), then
   rewrite every expression's old index numbers per the table (regex replace
   `dropMenu\s*==\s*<old>\b` → `dropMenu == <new>` per unique old number — do NOT touch
   numbers compared against *other* variables like `nowSoon`/`vodPath`/`twoRows`, which
   appear in the same expressions but are unrelated).
4. **Verify**: check `expressionError` is empty on every edited (and spot-check untouched)
   property; a quick before/after numeric sweep or a render is good but not always
   necessary once the pattern is this mechanical.

## Scripting gotchas hit this session (AE 26.2.1x2, confirmed still true)
- `menu.propertyParameters` returns a live/getter array — **must copy it** (`for` loop push,
  or pass a literal) before feeding back into `setPropertyParameters`; passing the same
  reference throws `"ReferenceError: Object is invalid"`.
- **`setPropertyParameters` mints the effect a new internal `matchName` AND resets its
  display name** (observed: reset to "Channel", not the "Channel Selection 2" example from
  the older memory note — AE's auto-naming varies) — confirms `reference_ae_pseudo_dropdown.md`
  still holds.
- **The `eff`/`menu` variable held from BEFORE the `setPropertyParameters` call becomes
  stale/invalid immediately after** — any further access (even just reading `.name`) throws
  `"ReferenceError: Object is invalid"`. Fix: after calling `setPropertyParameters`, re-fetch
  the effect fresh (by index — it keeps its position in the Effect Parade — or by its
  current, possibly-mutated name) before renaming or reading anything else. Hit this twice
  before landing on the right sequence; do it right the first time on the remaining comps.
- After renaming back, expressions that reference the effect by name and were evaluated
  *during* the brief mis-named window can show a transient "effect ... is missing" error
  that clears on its own on next evaluation — don't panic, just re-check `expressionError`
  in a fresh script run before concluding something is broken. If it doesn't clear, force a
  re-link by reassigning `prop.expression = prop.expression` (no content change, forces AE
  to recompile).
- `NOW/SOON` dropdown only has 3 valid values (1–3) — a test sweep to 4 throws a range
  error. Its resting value got left at a test artifact (`3`) during this session with no
  recorded true original — low stakes (preview-only control), flagged to user, not yet
  resolved.
- Setting a dropdown's *current* value must use `menu.setValue(n)`, not `menu.value = n` —
  the latter throws `"Unable to set 'value'. It is a readOnly attribute."` (hit on Intro;
  Vertical_End Frame's earlier remap apparently used `setValue` already, undocumented at the
  time). Update the methodology's step-3 snippet mentally to `setValue`, not direct
  assignment.
- **New mismatch pattern (Intro, recurred at much larger scale in Autobus)**: watch for a
  hardcoded index that matches a **separator's** old position, always OR'd with another
  still-valid index for the same semantic target (e.g. `dropMenu == 9 || dropMenu == 14`,
  where 9 was the separator and 14 was VOD). Reads as leftover intent from a prior
  reordering, not a random typo — before mechanically mapping a separator-index reference to
  `-1`, check whether it's paired with a live index in an OR-condition; if so, surface it to
  the user (kill / redirect to the paired target / leave alone) rather than silently killing
  possibly load-bearing behavior. Don't assume the same numeric override applies to other
  comps — re-derive per comp (confirmed again on Autobus: same `9`-as-VOD-alias pattern,
  same redirect decision, but this was independently re-confirmed with the user, not
  assumed).
- **Comps can have MORE than one dropdown whose relevance is gated by Channel Selection**
  (Autobus: `VOD Path` gated by `== VOD`, `VOD Kids Path` gated by `== VOD KIDS`). Always ask
  the user directly whether sibling dropdowns exist before considering a comp's mapping
  complete — don't assume Channel Selection is the only pseudo-dropdown effect in scope.
  These sibling dropdowns can have their OWN independent index/ordering issues (Autobus's
  `VOD Path` had a separator at old index 2 that needed deleting, shifting every later
  `vodPath==N` down by one) — treat each as its own full map→build→rewire cycle, layered on
  top of (not instead of) the Channel Selection rewire.
- **Scripting technique for multi-dropdown rewires**: when an expression can reference
  several different pseudo-dropdown effects (each via its own arbitrarily-named local
  variable — `dropMenu`, `ddm`, `vodPath`, `Menu`, `vodkidsPath` were all seen), don't
  blanket-regex a fixed variable name. Instead, per expression: regex-match
  `(\w+)\s*=\s*(?:comp\("HostComp"\)\.layer\("controls"\)|thisComp\.layer\("controls"\))\.effect\("EffectName"\)\("Menu"\)(?:\.(?:value|text))?`
  to discover which local variable name was assigned from which effect in *that specific
  expression*, then apply each effect's own old→new table only to comparisons against its
  matching variable name (`\bVARNAME\s*==\s*(\d+)\b`). This correctly skips dangling
  references to a stale/wrong comp (e.g. the `COLORS (Essentail Graphics Here) 01` refs,
  which don't match the `comp("Autobus")`/`thisComp` pattern and are left untouched) without
  needing a separate exclusion list.

## Status
- ✅ **Vertical_End Frame + `_MESSAGING 13`**: fully done. Item list updated, effect renamed
  back, current value remapped 9→11, all 5 direct expressions + all 15 `_MESSAGING 13`
  expressions verified (unique valid target index or `-1`, zero errors). Render-verified
  visually clean.
- ✅ **Autobus** (+ its two dependent dropdowns, `VOD Path` and `VOD Kids Path`): fully done.
  Channel Selection updated to the 13-item unified list (YES PLUS added new — Autobus never
  had it), value remapped 13→11 (VOD), same `9`-paired-with-a-live-index anomaly as Intro
  found again here (dozens of layers gated on `dropMenu == 9 || dropMenu == 13`) — user
  confirmed the same resolution (redirect 9→11, matching 13). **New pattern: this project
  turned out to have TWO more dropdowns whose relevance is gated by Channel Selection**:
  `VOD Path` (relevant only when Channel Selection == VOD) and `VOD Kids Path` (relevant only
  when Channel Selection == VOD KIDS) — both live on the same "controls" layer as Channel
  Selection. Their *own* item-list audit surfaced a similar reordering need: `VOD Path` had a
  separator at old index 2 that user asked to delete outright (not just leave invisible),
  requiring `VOD Path`'s own 10-item list to shrink to 9 and every `vodPath==N` (N≥3)
  reference to shift down by one — same mechanical table approach, just against a second,
  independent dropdown menu on the same effect stack. `VOD Kids Path` needed no reordering
  (all 3 items already correctly referenced). Also found and fixed (user-confirmed) one
  genuine mismatch: `VOD KIDS/Opacity` was gated on old `dropMenu == 10` (YES GENERAL)
  instead of the VOD-family condition its near-twin `VOD KIDS 2/Opacity` used — corrected to
  match. 147 expressions edited project-wide (across 3 tables applied per-expression by
  detecting which local variable name was assigned from which effect's `Menu` value — see
  new scripting technique below), zero expression errors. Two more dangling
  `comp("COLORS (Essentail Graphics Here) 01")` refs found inside Autobus itself — same
  deferred open question as Intro's, left untouched (not remapped).
  **Follow-up tuning pass**: user asked to delete `MOVIES KIDS`, `VOD KIDS`, and
  `VOD KIDS STORE` from `VOD Path` entirely — not relevant there, since that content now
  lives in the separate `VOD Kids Path` dropdown instead. Shrunk `VOD Path` 9→6 items
  (`NEW SERIES, 24/7, DOCU, MOVIE STORE, LONDON, MYSTERY`), remapped the 3 deleted items to
  `-1`, `MYSTERY` shifted 9→6. 37 more expressions rewired (0 errors) — correctly rendered
  the `VOD KIDS`/`VOD KIDS 2` "kids variant" layers (whose whole condition was 3 now-deleted
  `vodPath` values OR'd together) permanently invisible, which is the intended outcome now
  that `VOD Kids Path` owns that content.
  **Cleanup pass**: user asked to delete every layer whose Opacity expression contains
  `== -1`. This needed care: 49 layers matched textually, but only **43 were genuinely fully
  dead** (whole condition reduces to always-false); **6 merely contained one dead `-1`
  OR-branch inside an otherwise-still-live condition** (e.g. the NOW/SOON messaging + VOD
  logo layers still fire correctly for `vodPath == 1..5`; the two channel-name-picker layers
  still fire for most Channel Selection values) — deleting those 6 would have destroyed live
  content. Flagged to the user, who confirmed deleting only the 43 truly-dead ones.
  Classified programmatically: extract all `dropMenu == N`/`vodPath == N` values per
  expression; a clause is dead only if *every* value in it is `-1` (an OR mixing `-1` with
  any live number is NOT dead). Deleted by layer name (not index, since indices shift
  mid-deletion) via `layer.remove()`. Autobus went 176→133 layers; the 6 kept layers verified
  still present with empty `expressionError`.
  **Reverted by user**: deleting these 43 layers broke OTHER, still-live layers whose
  Position expressions referenced the deleted layers **by name** (the `‹` arrow layers use
  `thisComp.layer("VOD Path NN").sourceRectAtTime().width` to compute their own X Position —
  a dependency my scan never checked, since I only audited Opacity expressions before
  deleting). User reverted the deletion in AE; Autobus is back to 176 layers. **Standing
  decision: leave the `== -1` layers in place, do not delete them** — this matches the
  original convention used everywhere else in this project (deleted dropdown items keep their
  layer, just permanently invisible). **Lesson for any future deletion request**: before
  deleting ANY layer, project-wide-scan for references to that layer **by name** across ALL
  property types (not just Opacity, not just dropMenu/vodPath-style conditions) —
  `sourceRectAtTime`, `thisComp.layer("Name")`, or similar name-based lookups from sibling
  layers are a real, easy-to-miss dependency.
- ✅ **Intro + `Yes VOD intro`**: fully done. Item list updated to the 13-item unified list
  (no label normalization needed — Intro's existing labels already matched exactly), effect
  renamed back to "Channel Selection", current value remapped 14→11 (VOD). 27 of 42 relevant
  expressions edited (15 needed no change: 7 DOCU-gated at `==8`, 7 unchanged 1–7 MOVIES/TV
  refs, 1 text-based `"VOD KIDS"` comparison immune to reindexing). Zero expression errors on
  final check. **One anomaly found and resolved with the user**: 16 of the 42 refs (the
  entire `Yes VOD intro` precomp + its 7 nested layers, `HD Frame`, 6 "egnib..." reversed-text
  docu-movies layers, and 2 `Union Jack Flag` refs) were gated on `dropMenu == 9` — which in
  Intro's OLD list was the separator, not a real item — always paired with `dropMenu == 14`
  (VOD) in OR-conditions, and the whole precomp is literally named "Yes VOD intro". User
  decided (given the choice: kill it / redirect to VOD / leave alone) to **redirect all 16 to
  the new VOD index (11)**, same target as the `==14` refs — this is a real, deliberate legacy
  design (not a bug from this project), now consistently mapped instead of accidentally
  orphaned by the reorder. The `9→-1` mechanical default from the table was overridden to
  `9→11` specifically for this reason; this override is Intro-specific, not a global rule
  change — re-derive fresh for each remaining comp rather than assuming `9→11` elsewhere.
- ✅ **Vertical_Intro** (+ `VOD Path`): fully done. Same 15-item Channel Selection structure
  as Intro (identical order, same `dropMenu == 9`-paired-with-`14` legacy-VOD-alias pattern) —
  applied the identical resolution (redirect 9→11) since the user framed this comp as
  "basically the same structure as Intro" and the pattern matched exactly (confirmed via the
  same 2x-precedent from Intro and Autobus, not re-asked this time). Item list updated to the
  13-item unified list, value remapped 14→11 (VOD). `VOD Path` effect (this comp's name for
  the dependent VOD-sub-path dropdown, vs. Intro's differently-named `VOD Selection` which was
  never touched) had a **leading** separator (old index 1, not trailing like Autobus's) —
  deleted it, shrinking 7→6 items to exactly match Autobus's already-cleaned final list
  (`NEW SERIES, 24/7, DOCU, MOVIE STORE, LONDON, MYSTERY`), value remapped 2→1 (NEW SERIES,
  unchanged). **Investigated a suspected off-by-one bug that turned out NOT to be one**: 6
  "egnib..." (reversed-Hebrew) docu-movies-variant layers + `Union Jack Flag` check
  `vodPath == 1..6` — cross-checked each against its (translated) layer name vs. the actual
  item at that position: values 2–6 all matched their real content exactly (`vodPath==2`→"new
  series" layer, `==3`→"7/42" layer, `==4`→"movie store" layer, `==5`/`==6`→London/Union-Jack
  layers) with NO shift needed. Only `vodPath==1` (a "new movies"-labeled layer, no OR'd
  partner) was checking the dead separator position — a standalone orphaned reference (the
  "NEW MOVIES" category was apparently removed/merged at some point), not a legacy alias
  pairing with a live value like the `dropMenu==9` pattern. Mapped it to `-1` per the standard
  convention; no user decision needed since it doesn't redirect anywhere. 22 expressions
  edited project-wide, zero expression errors. The two shared nested precomps
  (`Yes VOD intro`'s inner layers hardcode `comp("Intro")` explicitly regardless of host comp,
  already fixed via the Intro work; `INTRO VOD`'s dangling `COLORS...` ref is excluded from
  this comp's scope the same way, still deferred) needed no additional edits here.
- ✅ **End Frame** (+ `VOD Path`, `VOD KIDS Path`): fully done. Same 15-item Channel
  Selection structure as Intro/Vertical_Intro/Autobus — same `dropMenu==9`-as-legacy-VOD-alias
  pattern, redirected 9→11 again (matching precedent, not re-asked). **New independent
  confirmation of the 9→VOD pattern**: `TIMELINE Premiere/Line Color - VOD/Opacity` — a
  layer in a COMPLETELY DIFFERENT comp, explicitly labeled "VOD" — cross-references
  `comp("End Frame").layer("controls").effect("Channel Selection")` and checks `dropMenu==9`,
  which only makes sense if 9 truly meant VOD in some prior numbering. Item list → 13-item
  unified, value remapped 10→12 (VOD KIDS, End Frame's current selection was VOD KIDS, not
  VOD like the other comps). `VOD Path` (7 items, own labels kept as-is per the
  no-renaming rule — "VOD - NEW SERIES", "VOD - YES LONDON", "MYSTERY " with trailing space —
  these are End Frame's own established convention, not typos) had the same **leading**
  separator pattern as Vertical_Intro — deleted, 7→6 items, value 2→1 (unchanged). Same
  "orphaned New Movies at position 1" pattern as Vertical_Intro recurred here too (one layer,
  `erots dov ‹ סרטים חדשים`, checking the dead separator with no OR partner) — confirmed via
  the same cross-check method (values 2-7 all matched real content by translated layer name;
  only 1 didn't) and mapped to `-1`, no need to re-ask given the now-twice-established pattern.
  `VOD KIDS Path` (3 items: VOD KIDS, MOVIES KIDS, VOD STORE) needed no reordering. Regex
  substitution had to be extended to handle `!=` comparisons too (`vodPath != 7`), not just
  `==`, since End Frame's VOD-relevance gating uses "is NOT mystery" as often as "is a specific
  path". 81 expressions edited project-wide across both comps, zero expression errors.
- ✅ **Tag** (+ `Vertical_Tag`): fully done. Different structure from every other comp so far —
  14 items, no separator, no `YES PLUS`, and a genuinely **separate dedicated layer**
  (`OUTRO YES VOD`) for the stale `YES VOD` duplicate rather than a shared/OR'd alias
  condition like the recurring `dropMenu==9` pattern elsewhere. Controls layer is named
  `"Control"` here (singular), not `"controls"` — first comp where that assumption broke;
  worth checking the actual layer name per comp rather than hardcoding it. Mapped: 1-8
  unchanged, `YES VOD`(9)→`-1` (deleted, its dedicated `OUTRO YES VOD` layer goes
  permanently invisible per the Dev Plan's existing "plain VOD is the one kept" note),
  `VOD KIDS`(10)→12, `GENERAL YES`(11)→`-1`, `CINEMA`(12)→9 (normalized to `YES + CINEMA`),
  `DISMONDS`(13)→10 (normalized to `YES + DIAMONDS`), `VOD`(14)→11. **Special-cased the
  current dropdown value**: it was sitting on `YES VOD`(9) — since that item is being
  deleted, a plain `-1` remap would leave the live preview showing nothing; instead
  redirected the *current value only* to the new `VOD` index (11), matching "plain VOD is the
  one kept." This is a one-off exception to the mechanical old→new table (which still maps
  every other `dropMenu==9` reference, e.g. `OUTRO YES VOD`'s own opacity check, to `-1` as
  normal) — the value-remap and the list-item-reference-remap diverge here, unlike every
  other comp where they matched. No VOD Path/VOD Kids Path dependents on this comp. 14
  expressions edited across Tag + Vertical_Tag, zero errors.
- ✅ **Vertical_Tag's own `"Channel"` effect** (+ `_OUTRO tag vertical`): fully done. This is a
  **previously-missed 8th host** — not the same thing as the 4 `Tag_00022.png` refs already
  fixed under Tag (those reference `comp("Tag")`'s dropdown; this is Vertical_Tag's OWN,
  completely independent dropdown, on its own "controls" layer). Found only because a routine
  structural check (listing all layers + effects before assuming "just a nested precomp")
  turned up an effect literally named `"Channel"` — the exact generic name AE mints after
  `setPropertyParameters` resets a Pseudo effect's display name, meaning this effect HAD
  already been mutated by some prior (non-this-project) script or session, unrelated to this
  unification effort. Old list (16 items, no separator): 1-8 unchanged, `VOD`(9)→11,
  `VOD KIDS`(10)→12, `VOD LONDON`(11)→`-1` (deleted, matches the same deletion elsewhere),
  `GENERAL yes`(12)→`-1`, `yes+ CINEMA`(13)→9 (normalized), `yes+ DIAMONDS`(14)→10
  (normalized), `ISRAELI`(15)→`-1` (deleted), `yes VOD`(16)→`-1` (deleted, duplicate of VOD —
  same "plain VOD is the one kept" pattern as Tag's `YES VOD`, but here it wasn't the CURRENT
  value so no special redirect was needed, unlike Tag). Value unchanged (7→7, TV COMEDY, not
  affected by any deletion). Discovered a 5th nested precomp in the process:
  `_OUTRO tag vertical` (used as a layer inside Vertical_Tag), whose 7 internal layers
  reference `comp("Vertical_Tag").layer("controls").effect("Channel")` — the `OUTRO VOD`
  layer there already OR'd `VOD || VOD LONDON` together, so deleting VOD LONDON just leaves a
  harmless dead `-1` term without changing behavior. 10 expressions edited, zero errors.
  **Lesson**: even a comp already recorded as "just a nested precomp referencing another
  comp's dropdown" can ALSO have its own separate, unrelated dropdown — always list a comp's
  own layers/effects structurally before concluding there's nothing further to check there.
- ⏳ **Not yet started**: TIMELINE Premiere.
- Full project-wide reference dump (406 refs across 11 comps, pre-any-edit for the
  remaining 10) saved this session at `/tmp/project_wide_channel_selection_refs.json` —
  re-run the scan fresh before resuming since Vertical_End Frame's numbers have since
  changed (that file is now partially stale for that one comp).

## Open questions (deferred by user, resume here)
1. **`INTRO VOD` dangling reference** (shared precomp, used inside BOTH `Intro` and
   `Vertical_Intro`): currently points to `comp("COLORS (Essentail Graphics Here)
   01").layer("CHANNEL CONTROL")` — that comp **does not exist** (confirmed via project
   scan), leftover from an old project per the user. Plan: repoint to
   `comp("Intro").layer("controls")` (the precomp's own name suggests this is the "primary"
   host; assumes Intro/Vertical_Intro's dropdowns are normally kept in sync). But the layer
   itself ("egnib דוקו חדשים מהקולנוע nodnol", reversed text ≈ "new docu movies from
   London") was checking `dropMenu == 11` against an item — `VOD LONDON`-style — that exists
   in **neither** the old nor the new unified list. **User said "save this question, we'll
   continue later"** — do not guess; ask again when resuming (options discussed: map to
   DOCU=8, or disable/retire the layer, or user-specified).
2. `NOW/SOON` resting value on Vertical_End Frame (see gotcha above) — low priority, flagged
   not fixed.

See also `Knowledge Base/reference_ae_pseudo_dropdown.md` for the underlying API reference
this project validated against.
.........