---
name: AE Essential Graphics Panel Scripting
description: How to control the Essential Graphics Panel via ExtendScript — APIs, limitations, no comp-change events
type: reference
originSessionId: 4e317b49-a32d-44b5-99be-48d7ae104483
---
## Opening the EGP via Script

- `comp.openInEssentialGraphics()` — official CompItem API, opens comp in EGP
- `app.findMenuCommandId("Essential Graphics")` + `app.executeCommand(id)` — toggles panel visibility

## Comp Change Detection — NOT Supported

Adobe intentionally omitted comp-change events from ExtendScript and CEP for performance reasons:
- No `onActiveItemChanged`, `onCompChanged`, or similar callback
- ScriptUI panels cannot listen for events in other panels
- Only workaround: `app.scheduleTask()` polling (1s+ interval recommended, degrades on large projects, stops during modal dialogs)

## scheduleTask Polling Pattern

```jsx
var lastCompId = "";
app.scheduleTask(
    'var item = app.project.activeItem;' +
    'if (item instanceof CompItem && item.id !== lastCompId) {' +
    '  lastCompId = item.id;' +
    '  item.openInEssentialGraphics();' +
    '}',
    1000, true
);
```

Caveats: performance risk on large projects, stops during modal dialogs, scope issues (eval'd string), no clean shutdown for dockable panels.

## Sources

- ae-scripting.docsforadobe.dev (CompItem.openInEssentialGraphics)
- hyperbrew.co/blog/after-effects-command-ids (command ID lookup)
- Adobe Community forums (confirmed no comp-change events by design)
