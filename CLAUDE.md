# After Effects 2026 Workspace

This repo is a workspace for automating and building things in Adobe After Effects 2026.

## Skill

Always use the after-effects skill at `~/.agents/skills/after-effects` for all tasks. This includes writing scripts, applying expressions, changing properties, effects, layers, text, building extensions — anything that touches AE.
https://github.com/aedev-tools/adobe-agent-skills

## AE Version

- Adobe After Effects 2026 (version 26.x)
- Config is set at `~/.ae-assistant-config`

## Workflow

- Follow the after-effects skill workflow (SKILL.md) for every task: gather context, load rules, generate scripts, execute via runner.sh
- Always query active state before making changes
- Use `--background` flag for all read-only queries to avoid stealing focus from AE

## ExtendScript Quick Reference

Full docs: https://extendscript.docsforadobe.dev/

### Language Constraints (ES3)

- `var` only — no `let`, `const`, arrow functions, template literals, destructuring, classes, promises
- No `Array.forEach/map/filter/reduce/indexOf` — use `for` loops
- No `JSON.parse`/`JSON.stringify` without including json2.jsx
- No `.trim()`, `.startsWith()`, `.endsWith()` on strings
- Has `#include` preprocessor directives (not standard JS)
- Has E4X (XML literals) built in

### Preprocessor Directives

| Directive | Purpose |
|-----------|---------|
| `#include "file.jsxinc"` | Include external script |
| `#includepath "dir1;dir2"` | Set include search paths |
| `#target aftereffects` | Target AE |
| `#targetengine "main"` | Required for persistent palette windows |
| `#strict on` | Strict error checking |

### Dollar ($) Object — Debugging & Environment

| Property/Method | Description |
|----------------|-------------|
| `$.version` | JS engine version |
| `$.os` | OS version string |
| `$.fileName` / `$.line` / `$.stack` | Current script location and stack trace |
| `$.error` | Most recent runtime error |
| `$.writeln(text)` | Write to JS console |
| `$.sleep(ms)` | Pause execution |
| `$.gc()` | Force garbage collection |
| `$.evalFile(path)` | Load and evaluate a script file |
| `$.getenv(name)` | Get environment variable |
| `$.hiresTimer` | Microsecond timer (resets on each read) |
| `$.colorPicker(hex)` | System color picker, returns `0xRRGGBB` |

### File I/O

```jsx
// Write
var f = new File("/path/to/file.txt");
f.encoding = "UTF-8";
f.open("w");        // "r"=read, "w"=write, "e"=edit, "a"=append
f.write("content");
f.close();

// Read
f.open("r");
var content = f.read();
f.close();

// Line-by-line
f.open("r");
while (!f.eof) { var line = f.readln(); }
f.close();
```

**File dialogs:** `File.openDialog(prompt, filter, multiSelect)`, `File.saveDialog(prompt, filter)`

### Folder Shortcuts

| Property | Path |
|----------|------|
| `Folder.desktop` | User's desktop |
| `Folder.myDocuments` | User's documents |
| `Folder.userData` | Per-user app data |
| `Folder.temp` | System temp |
| `Folder.current` | Working directory (read/write) |

**List files:** `folder.getFiles("*.jsx")` — accepts wildcards or filter function

**Warning:** On macOS, file paths longer than 1002 characters crash AE.

### ScriptUI (Dialogs & Palettes)

```jsx
var dlg = new Window("dialog", "Title");   // "dialog" = modal, "palette" = floating
dlg.add("statictext", undefined, "Label:");
var input = dlg.add("edittext", undefined, "default");
input.characters = 30;
var btn = dlg.add("button", undefined, "OK", {name: "ok"});
dlg.show();  // returns 1=OK, 2=Cancel
```

**Control types:** `button`, `iconbutton`, `image`, `statictext`, `edittext`, `checkbox`, `radiobutton`, `progressbar`, `slider`, `scrollbar`, `listbox`, `dropdownlist`, `treeview`, `panel`, `group`, `tabbedpanel`, `tab`

- Buttons with `{name: "ok"}` auto-bind to Enter, `{name: "cancel"}` to Escape
- Palette windows require `#targetengine "main"` to persist
- `alert()`, `confirm()`, `prompt()` available globally without a Window

### Reflection (Runtime Introspection)

```jsx
var obj = new File("test");
obj.reflect.properties;   // array of property info
obj.reflect.methods;       // array of method info
obj.reflect.find("open");  // info for specific member
```

Useful for discovering available properties/methods on AE DOM objects at runtime.

### Key Gotchas

- `File()` without `new` may return a Folder if path is a directory — always use `new File()`
- Set `file.encoding = "UTF-8"` before read/write for reliable text
- `#include` files can't be debugged (no breakpoints)
- `$.hiresTimer` resets on each access — store value, read again, subtract for timing
