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

## Scope: 7 host comps + 4 nested/cross-comp precomps (11 total, found via project-wide scan — see below)
| Host comp | Deletions needed | Additions needed | Nested precomp(s) that ALSO reference its "Channel Selection" |
|---|---|---|---|
| Autobus | separator, YES GENERAL | YES PLUS | — |
| End Frame | separator, GENERAL YES | — (has YES PLUS) | — |
| Intro | separator, GENERAL YES | — (has YES PLUS) | `Yes VOD intro` (7 refs, all `comp("Intro")`); `INTRO VOD` (1 ref, currently dangling — see Open Questions) |
| Tag | GENERAL YES, YES VOD (dup) | YES PLUS | `Vertical_Tag` (4 refs, all `comp("Tag")`, same layer "Tag_00022.png") |
| Vertical_End Frame | VOD LONDON, GENERAL yes, ISRAELI, separator (4 deletions — most of any comp) | YES PLUS | `_MESSAGING 13` (15 refs, all `comp("Vertical_End Frame")`) — **DONE, see below** |
| Vertical_Intro | separator, GENERAL YES | — (has YES PLUS) | `INTRO VOD` (shared with Intro — see Open Questions) |
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

## Status
- ✅ **Vertical_End Frame + `_MESSAGING 13`**: fully done. Item list updated, effect renamed
  back, current value remapped 9→11, all 5 direct expressions + all 15 `_MESSAGING 13`
  expressions verified (unique valid target index or `-1`, zero errors). Render-verified
  visually clean.
- ⏳ **Not yet started**: Autobus, End Frame, Intro (+ `Yes VOD intro`, + `INTRO VOD` open
  question), Tag (+ `Vertical_Tag`), Vertical_Intro (+ `INTRO VOD` open question), TIMELINE
  Premiere.
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
