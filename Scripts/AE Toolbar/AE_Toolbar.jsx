// AE Toolbar — a dockable panel that turns the scripts in the "AE_Toolbar_Utilities" folder next
// to this file into one-click buttons. Drop a new .jsx file into that folder and click "Refresh
// List" (or reopen the panel) to get a new button for it automatically — no editing this file
// required.
//
// Run: copy this file AND the "AE_Toolbar_Utilities" folder next to it (as siblings — AE only
//      registers panels sitting directly in this folder, not nested a level down) into
//      /Applications/Adobe After Effects 2026/Scripts/ScriptUI Panels/
//      then open it in AE via Window > AE_Toolbar.jsx (docks like any native panel).
//      Can also be run once without docking via File > Scripts > Run Script File...
#target aftereffects
#targetengine "main"

// $.fileName is a shared, mutable ExtendScript engine property -- it reflects whichever script
// most recently started executing, anywhere in this AE session, not necessarily this one. If any
// other script runs via DoScriptFile after this panel opens (routine when using an AE-scripting
// assistant), $.fileName silently drifts to point at THAT script instead. Captured once, right
// here, at the very top of this script's own execution -- before anything else can possibly run
// and overwrite it -- so the reload link below always re-reads the right file.
var THIS_SCRIPT_FILE = $.fileName;

var UTILITIES_FOLDER_NAME = "AE_Toolbar_Utilities";

function getUtilitiesFolder() {
    var selfFile = new File(THIS_SCRIPT_FILE);
    return new Folder(selfFile.parent.fsName + "/" + UTILITIES_FOLDER_NAME);
}

function runUtility(fsPath, label) {
    // Each utility script manages its own undo group internally (or doesn't need one, e.g. a
    // read-only tool like Copy Ease). Wrapping it in another begin/end pair here too caused
    // nested undo groups that AE's dockable-panel engine didn't reliably keep balanced, showing
    // "Undo group mismatch" the next time the user did something undo-tracked -- and AE's
    // auto-fix for that rolled back further than expected. Don't double-wrap.
    try {
        $.evalFile(fsPath);
    } catch (e) {
        alert("AE Toolbar error running \"" + label + "\":\n" + e.toString());
    }
}

// ---------- UI ----------

function buildUI(thisObj) {
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "AE Toolbar", undefined, { resizeable: true });
    panel.orientation = "column";
    panel.alignChildren = ["fill", "top"];
    panel.spacing = 6;
    panel.margins = 10;

    var headerRow = panel.add("group");
    headerRow.orientation = "row";
    headerRow.alignChildren = ["left", "center"];
    headerRow.alignment = ["fill", "top"];

    var title = headerRow.add("statictext", undefined, "AE Toolbar");
    title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 13);
    title.alignment = ["left", "center"];

    // Dev tool: AE only reads a ScriptUI Panels file once when the panel is first opened in a
    // session, so normally you'd have to restart AE to see edits. This re-reads the file from
    // disk and rebuilds the panel's contents in place instead.
    var reloadLink = headerRow.add("statictext", undefined, "reload script");
    reloadLink.alignment = ["right", "center"];
    reloadLink.addEventListener("mousedown", function () {
        try {
            $.global.__aeToolbarReloading = true;
            while (panel.children.length > 0) {
                panel.remove(panel.children[0]);
            }
            $.evalFile(new File(THIS_SCRIPT_FILE));
            buildUI(panel);
            panel.layout.layout(true);
            panel.layout.resize();
        } catch (e) {
            alert("Reload failed: " + e.toString() + " (line " + e.line + ")");
        } finally {
            $.global.__aeToolbarReloading = false;
        }
    });

    var buttonGroup = panel.add("group");
    buttonGroup.orientation = "column";
    buttonGroup.alignChildren = ["fill", "top"];
    buttonGroup.spacing = 4;

    function refresh() {
        while (buttonGroup.children.length > 0) {
            buttonGroup.remove(buttonGroup.children[0]);
        }

        var utilFolder = getUtilitiesFolder();
        if (!utilFolder.exists) {
            buttonGroup.add("statictext", undefined, "No \"" + UTILITIES_FOLDER_NAME + "\" folder found next to this script.");
            panel.layout.layout(true);
            return;
        }

        var files = utilFolder.getFiles("*.jsx");
        if (!files || files.length === 0) {
            buttonGroup.add("statictext", undefined, "No utility scripts found.");
            panel.layout.layout(true);
            return;
        }

        files.sort(function (a, b) {
            return a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1;
        });

        for (var i = 0; i < files.length; i++) {
            (function (file) {
                var label = file.displayName.replace(/\.jsx$/i, "");
                var btn = buttonGroup.add("button", undefined, label);
                btn.onClick = function () {
                    runUtility(file.fsName, label);
                };
            })(files[i]);
        }

        panel.layout.layout(true);
    }

    var refreshBtn = panel.add("button", undefined, "Refresh List");
    refreshBtn.onClick = refresh;

    refresh();

    panel.layout.layout(true);
    panel.layout.resize();
    panel.onResizing = panel.onResize = function () { this.layout.resize(); };

    return panel;
}

// Skip the auto-run when this file is being re-read by the reload link above -- it already has a
// reference to the existing panel and calls buildUI(panel) itself; auto-running here too would
// pop open a second, redundant floating window.
if (!$.global.__aeToolbarReloading) {
    var aeToolbarPanel = buildUI(this);
    if (aeToolbarPanel instanceof Window) {
        aeToolbarPanel.center();
        aeToolbarPanel.show();
    }
}
