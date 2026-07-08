---
name: reference-ae-pseudo-dropdown
description: "AE pseudo-effect dropdowns — how to read items, how setPropertyParameters mutates the effect, and the rename-back gotcha"
metadata: 
  node_type: memory
  type: reference
  originSessionId: bcf190eb-3ddd-4525-a54e-d0f6f0ae558d
---

# Modifying pseudo-effect dropdown menus in After Effects

Confirmed on AE 26.2.1x2.

## Read existing items

For any dropdown property (built-in Dropdown Menu Control OR a Pseudo effect's Menu), the items live on `propertyParameters`:

```jsx
var menu = effect.property(1);          // the "Menu" property
var items = menu.propertyParameters;    // -> ["NEW MOVIES", "NEW SERIES", ...]
menu.isDropdownEffect;                  // true
typeof menu.setPropertyParameters;      // "function"
```

No documented method exposes items for pseudo dropdowns, but `propertyParameters` works and is the reliable read path.

## Write new items — and what AE silently does to a Pseudo effect

`menu.setPropertyParameters(newArray)` REPLACES the menu list entirely (no append API), so first copy `propertyParameters`, push your additions, then call.

**Critical gotcha:** when called on a Pseudo effect (matchName `Pseudo/@@…`), AE creates a new pseudo-effect TYPE under the hood:

- The effect keeps its position in the Effect Parade and all its keyframes / property links
- `effect.matchName` changes to a NEW `Pseudo/@@…` value
- `effect.name` (the display name shown in the UI) gets reset to something AE picks — observed: original "VOD Selection" was reset to "Channel Selection 2"

This breaks every expression that referenced the effect by name (e.g. `effect("VOD Selection")("Menu")`). After the call, you MUST rename it back:

```jsx
menu.setPropertyParameters(newItems);
if (effect.name !== originalDisplayName) effect.name = originalDisplayName;
```

The new matchName is permanent; only the display name needs restoring. Property lookup by name (`effect("VOD Selection")`) works again immediately after.

## Side effect: lookup quirks immediately after a duplicate

Right after `layer.duplicate()`, calling `controls.property("ADBE Effect Parade").property("Pseudo/@@xxx")` on an UNRELATED layer can return null in the same script run (observed once in this debug session). Fall back to iterating `fx.numProperties` and matching by `.matchName` — that lookup remained reliable.

## See also
- [[reference-ae-expressions]] for the expressions we've validated
