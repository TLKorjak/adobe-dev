# Plan: PPro MOGRT Batch Controller (CEP Extension)

A **general tool that batch-controls MOGRT parameters across the SELECTED MOGRTs on the
timeline** — dropdowns, checkboxes, sliders, color, text — in one click.

**Selection-based by design:** the extension only ever acts on elements the user has selected
in the timeline. There is no "all MOGRTs" mode — nothing happens to unselected clips, ever.
Select the clips you want, choose a value, apply.

**First feature (milestone target):** the **"Subs variations" switcher** — select multiple
Subs subtitle MOGRTs on the timeline and switch their `Subs variations` dropdown between two
values, in one click (see v0.1 below). Later, the same engine drives other cases through the
same discover → group → dispatch pipeline — e.g. a **"versions" dropdown**
(בקרוב / עכשיו / מחר / היום / …) across selected MOGRTs, checkboxes that toggle something
on/off, sliders, etc. — no rewrite, just more control types. Always scoped to the selection.

## v0.1 — concrete first target: "Subs variations" switcher
Narrower and more specific than the general vision, to ship something real first.

- **The MOGRT:** a subtitles template whose EGP name is **"Subs"**. Its exposed params
  (from the screenshot): `Subs Text` (text), `Shadow Opacity` (slider 0–100), and
  **`Subs variations`** (dropdown).
- **The dropdown:** `Subs variations`, exactly **two options** — `Subs Default` (currently
  index 0, checked) and `Subs Yes Plus` (index 1).
- **Scope = the timeline SELECTION** (the tool's universal rule — see above). The user selects
  several Subs clips on the active sequence; the tool acts only on those. **Confirmed:** act on
  selected clips that expose `Subs variations`; **skip** any other selected clips silently
  (report skipped count).
- **Action:** set `Subs variations` to a chosen option on **every selected Subs clip** in one
  click. Two explicit buttons — **"Subs Default"** and **"Subs Yes Plus"** — rather than a
  blind toggle, so behavior is well-defined even when the selection is mixed. (A toggle can be
  added later if wanted.)
- **Identify by param displayName** (`Subs variations`), not the clip name — robust if the
  clip is renamed. Skip selected clips that don't expose that param.

### v0.1 must confirm from the real project (via discover on the selection)
1. How to read the current **timeline selection** in classic ExtendScript
   (`sequence.getSelection()` array vs iterating `clip.isSelected()`).
2. The **value representation** of `Subs variations` — integer index (`0`/`1`) vs string
   (`"Subs Default"`) — and whether `setValue(0|1, true)` sticks on a dropdown.
3. Which **component index** the MOGRT is, and that `Subs variations` is reachable there.

## Decisions locked with the user
- **Selection-based, always.** The tool acts only on the timeline selection — no "all MOGRTs"
  mode, now or later. Every `discover`/`apply` operates over the selected clips only.
- **General tool, not one-off.** The `Subs variations` dropdown is the first control handled;
  the architecture must handle any MOGRT param type (a "versions" dropdown, checkboxes,
  sliders, …) without special-casing.
- **CEP, not UXP.** UXP MOGRT param reads crashed PPro 2026 before (see
  `project_mogrt_control_plugin.md`); classic ExtendScript reaches MOGRT params directly.
- **All MOGRTs are the same template (for now)** → identical params batch cleanly. Design
  still groups by param identity so a mixed-template timeline degrades gracefully later.
- **Deploy to 2 machines** → build dev-first (dev folder), then package a signed `.zxp`.

## Why CEP is viable here (verified on this machine)
- PPro 2026 still ships CEP: `PlugPlug.framework`, `CEPHtmlEngine.app` (**CEP 12**),
  `Contents/CEP` all present.
- `PlayerDebugMode` already set for CSXS 10/11/12 → unsigned dev extensions load.
- ~12 CEP panels already installed (bodymovin, EdiTurtle, AEUX, …) → ecosystem works.
- The dead AppleScript `DoScriptFile` bridge is irrelevant: a CEP panel runs ExtendScript
  **internally** via `CSInterface.evalScript()`, not over AppleScript.

## Core concept: discover → group → dispatch
The whole tool is one generic pipeline; the `Subs variations` dropdown is just the first thing
that flows through it.
```
 DISCOVER            GROUP                        DISPATCH (per type)
 ────────            ─────                        ───────────────────
 scan the      →  merge params that appear   →   dropdown  → setValue(index|string)
 SELECTED          on multiple selected           checkbox  → setValue(0|1 / bool)
 MOGRTs'           MOGRTs into one "batch          slider   → setValue(number)
 exposed           control" keyed by               color     → setColorValue(a,r,g,b)
 params+types      displayName+type                text     → setValue(string)
```
- **Discover** = the Phase-1 scan, promoted from a diagnostic to the tool's engine.
- **Group** = params common across the selected MOGRTs collapse into a single UI control
  (set once → all selected).
- **Dispatch** = a small type→setter map; adding a control type = adding one case.

## Architecture
```
 CEP panel (HTML/JS)                 ExtendScript host (jsx)             PPro DOM
 ─────────────────                  ──────────────────────             ─────────
  dynamic controls  ──evalScript──▶  discover(): dump selected MOGRTs      clip.components[i]
  (one per grouped                   apply(controlId, value): dispatch by    .properties[j]
   param), Apply-all ◀──JSON return─  type across selected matching clips    .getValue()/.setValue()
        │                             mirrors result → /tmp for dev loop    .setColorValue()
        └── UI is generated from the discover() result, not hardcoded
```
HTML panel = human interface, `evalScript` = bridge, ExtendScript = PPro interface.
`/tmp/mogrt-switcher-result.json` is the **dev feedback loop** — user clicks, host writes
JSON, Claude reads it from the terminal (no panel copy-paste).

## Directory layout (in repo, symlinked into CEP extensions)
```
mogrt-batch-controller/
  CSXS/manifest.xml        CEP12 manifest, Host=PPRO, ScriptPath=./jsx/host.jsx
  index.html               panel shell
  js/CSInterface.js        Adobe lib (copied from an installed panel)
  js/main.js               panel logic: build controls from discover(), evalScript apply()
  jsx/host.jsx             ExtendScript: discover(), apply(), type dispatch
  .debug                   remote-debug ports (optional, CEF devtools)
  icons/                   panel menu icons (normal/rollover/dark)
  README.md
```
Dev install: symlink `mogrt-batch-controller` →
`~/Library/Application Support/Adobe/CEP/extensions/tv.promots.mogrt-batch-controller`.
Panel appears under **Window → Extensions → MOGRT Batch Controller**.

## manifest.xml essentials
- `ExtensionBundleId = tv.promots.mogrt-batch-controller`, one `<Extension>` panel id.
- `<Host Name="PPRO" Version="[14.0,99.9]" />`; `<RequiredRuntime Name="CSXS" Version="9.0" />`.
- `MainPath=./index.html`, `ScriptPath=./jsx/host.jsx`, `AutoVisible=true`, `Type=Panel`.

## THE key unknown → the param TYPE MODEL (resolved by discover() before any write)
For a general tool we must know, per MOGRT param, from classic ExtendScript:
1. **Type / control kind** — is there a `param.kind`/type field, or must type be inferred
   from the value shape? (dropdown vs checkbox vs slider vs color vs text)
2. **Value representation** per type:
   - dropdown → integer index (0/1-based?) or string label?
   - checkbox → boolean / 0–1 / other?
   - slider → raw number, and is it normalized (0–1) or real units?
   - color → `getColorValue()`/`setColorValue()` shape?
3. **Option enumeration** — can a dropdown's option labels be read from script, or must the
   label↔index map be captured once from the scan?
4. **Identity for grouping** — displayName is the key; confirm it's stable/identical across
   the same-template MOGRTs, and capture matchName + component index as backups.

`discover()` dumps all of this (each `getValue()` in try/catch). We read the `/tmp` dump on
the **real** project and lock the type model before writing `apply()`.

## Dispatch table (grows over time; `Subs variations` dropdown = first entry)
| Control kind | Read | Write | Notes |
|---|---|---|---|
| **dropdown** (`Subs variations`, later "versions") | `getValue()` | `setValue(index\|string, true)` | v0.1; map label→index once if not enumerable |
| checkbox | `getValue()` | `setValue(0\|1, true)` | toggle on/off across selected MOGRTs |
| slider | `getValue()` | `setValue(number, true)` | confirm normalized vs real units |
| color | `getColorValue()` | `setColorValue(a,r,g,b,true)` | |
| text | `getValue()` | `setValue(string, true)` | |
Adding a kind = add a row here + a UI widget; the discover/group/apply flow is unchanged.

## Panel UI (dynamic, minimal — matches TC Markers "simplify" aesthetic)
- Header + active-sequence readout + **selected-clip count** (e.g. "3 MOGRTs selected").
- **Scan / Refresh** → runs `discover()` on the current selection, (re)builds the control list.
  (Empty/invalid selection → controls disabled + "Select MOGRT clips to begin".)
- **One control per grouped param**, widget chosen by type:
  dropdown→select, checkbox→toggle, slider→range+number, color→swatch, text→field.
  Each shows current value if uniform across the selection, or "mixed" if not.
- Per-control **Apply to selection** (and/or a global Apply). RTL-aware for Hebrew labels.
- Status line: "Set N/N selected — <control> = <value>", collapsible log.
- Bundle a font for consistent Hebrew rendering across machines (lesson from TC Markers).
- **First release (v0.1)** shows just the `Subs variations` dropdown; the generic renderer
  makes the others (versions dropdown, checkboxes, …) appear automatically as their dispatch
  cases are added.

## Dev loop
1. Symlink into CEP extensions; open panel in PPro 2026.
2. Panel runs `discover()` → writes `/tmp/mogrt-switcher-result.json`.
3. Claude reads it, edits `host.jsx`, user reloads panel (CEF right-click → Reload), repeat.
   Optional `.debug` → Chrome DevTools at `localhost:<port>` for JS-side debugging.

## Packaging for the 2nd machine
- Sign with `ZXPSignCmd` (self-signed cert OK) → `.zxp`; install via ZXPInstaller, or enable
  `PlayerDebugMode` there and copy the folder. Bundle font + icons for consistent look.

## Risks / open questions
- **setValue may not "stick"** for some MOGRT dropdown/param types (known historical quirk).
  Milestone 3 = single-clip write test before wiring "all".
- **Type detection** may need inference from value shape if no `kind` field exists.
- **Slider units / normalization** unknown until scanned.
- **Option enumeration** may be unavailable → label→index config (fine, same template).
- **Scope**: timeline selection only — universal, no "all MOGRTs" mode (confirmed). Tool is a
  no-op when nothing eligible is selected.
- **Undo granularity** — aim for one-step undo across the whole batch; confirm during build.
- **Locale/RTL** rendering of Hebrew in CEF — bundle font, `dir="rtl"`.

## Open decisions (to resolve before/during build)
Recommendations marked ★; unmarked = awaiting the user's call.

1. **Undo granularity** — ★ one click = a *single* undo step (one Cmd-Z reverts the whole
   batch). Confirm the ExtendScript API allows wrapping the batch in one history entry;
   fall back to per-clip undo only if not.
2. **Current-state readout** — ★ show a breakdown of the selection before acting
   ("3 selected · 2 Default · 1 Yes Plus") so mixed state is visible. Alternative: bare
   (buttons only).
3. **Control widget for v0.1** — two buttons (simplest for 2 options) **vs.** ★ render a real
   **dropdown** (matches EGP look, scales to N options for the general tool) + an "Apply to
   selection" button. Leaning dropdown so the UI pattern is reusable.
4. **Feedback after applying** — ★ transient status line ("Set 3/3 · skipped 1 non-Subs").
   Optional persistent log like the TC Markers panel.
5. **Resolve value format now, without the CEP build** — the one hard unknown (dropdown stores
   index `0/1` vs the string label) can be settled ahead of time by reading one Subs clip via
   the existing **Premiere Bridge** UXP plugin (safe `getValue()` read, no crash-prone
   patterns). ★ Do this read when PPro is up → de-risks milestone 2. Decision: whether to do
   this pre-read.
6. **Machine-2 packaging** — self-signed `.zxp` via `ZXPSignCmd` (needs cert + signing step)
   **vs.** enabling dev mode + copying the folder (as done before for the UXP tool). Pick the
   distribution method. (Default: dev-folder copy first, `.zxp` when stable.)

## Milestones
**v0.1 — Subs variations switcher (selection-scoped):**
1. **Scaffold** — manifest, CSInterface, empty panel loads in PPro 2026, shows active
   sequence name + selected-clip count. *(proves CEP + evalScript round-trip + selection read)*
2. **discover(selection)** — `/tmp` dump of the **selected** clips → confirm the selection
   API, find the `Subs variations` param, lock its value representation (index vs string).
3. **Single-clip write test** — set `Subs variations` on one selected clip; confirm it sticks
   + undo behaves. *(de-risks dropdown setValue)*
4. **Batch across selection** — two buttons (`Subs Default` / `Subs Yes Plus`) → set on every
   selected Subs clip in one click, with a "Set N/N" status. *(first shippable feature)*

**Beyond v0.1 — generalize into the batch controller:**
5. **Generalize discover/dispatch** — param type model for checkbox, slider, color, text;
   dynamic UI so any discovered param on the selection becomes a batch control. (Scope stays
   selection-only.)
6. **Polish** — status/log, font/RTL, icons, scope toggle.
7. **Package** — sign `.zxp`, install on machine 2.
