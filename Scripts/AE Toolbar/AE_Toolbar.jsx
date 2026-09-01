// AE Toolbar — a dockable panel that turns the scripts in the "AE_Toolbar_Utilities" folder next
// to this file into one-click buttons. Drop a new .jsx file into that folder and click "refresh
// list" (or reopen the panel) to get a new button for it automatically — no editing this file
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

    var linksGroup = headerRow.add("group");
    linksGroup.orientation = "row";
    linksGroup.alignChildren = ["right", "center"];
    linksGroup.alignment = ["right", "center"];
    linksGroup.spacing = 10;

    // Re-scans the utilities folder for new/removed/renamed .jsx files and rebuilds the button
    // list. refresh() is a function declaration further down in this same scope -- hoisted, so
    // it's safe to reference here even though it's defined later; only resolved when clicked.
    var refreshLink = linksGroup.add("statictext", undefined, "refresh list");
    refreshLink.addEventListener("mousedown", function () {
        refresh();
    });

    // Dev tool: AE only reads a ScriptUI Panels file once when the panel is first opened in a
    // session, so normally you'd have to restart AE to see edits. This re-reads the file from
    // disk and rebuilds the panel's contents in place instead.
    var reloadLink = linksGroup.add("statictext", undefined, "reload script");
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

    var BUTTON_WIDTH = 84;
    var BUTTON_HEIGHT = 22;
    var FLOW_SPACING = 4;

    var buttonGroup = panel.add("group");
    buttonGroup.orientation = "column";
    buttonGroup.alignChildren = ["left", "top"];
    buttonGroup.spacing = FLOW_SPACING;

    var currentItems = []; // cached {width, build(row)} items, so resize can re-flow without re-scanning disk

    // Small single-button flow item for a normal utility script.
    function makeSingleItem(file) {
        var label = file.displayName.replace(/\.jsx$/i, "");
        return {
            width: BUTTON_WIDTH,
            build: function (row) {
                var btn = row.add("button", undefined, label);
                btn.preferredSize = [BUTTON_WIDTH, BUTTON_HEIGHT];
                btn.onClick = function () { runUtility(file.fsName, label); };
            }
        };
    }

    // "Copy Ease" + "Paste Ease" merged into one paired, labeled control, separated by a divider,
    // since they're used back-to-back as a copy/paste pair. Uses ScriptUI's native "panel" type
    // (a bordered box with a built-in title) so the whole thing reads as one framed unit named
    // "Copy Ease", not two loose buttons.
    function makePairItem(copyFile, pasteFile) {
        var halfWidth = 58;
        var pairButtonHeight = BUTTON_HEIGHT + 10;
        var frameWidth = halfWidth * 2 + 26; // 2 buttons + spacing + comfortable side margins for the title
        return {
            width: frameWidth,
            build: function (row) {
                var frame = row.add("panel", undefined, "Copy Ease");
                frame.orientation = "row";
                frame.alignChildren = ["fill", "fill"];
                frame.spacing = 4;
                frame.margins = [10, 14, 10, 14];

                var copyBtn = frame.add("button", undefined, "Copy");
                copyBtn.helpTip = "Copy Ease";
                copyBtn.preferredSize = [halfWidth, pairButtonHeight];
                copyBtn.onClick = function () { runUtility(copyFile.fsName, "Copy Ease"); };

                var pasteBtn = frame.add("button", undefined, "Paste");
                pasteBtn.helpTip = "Paste Ease";
                pasteBtn.preferredSize = [halfWidth, pairButtonHeight];
                pasteBtn.onClick = function () { runUtility(pasteFile.fsName, "Paste Ease"); };
            }
        };
    }

    // Lays out cached items left-to-right, wrapping to a new row whenever the next item would
    // overflow the panel's current width. Cheap enough to re-run on every resize.
    function layoutFlow() {
        while (buttonGroup.children.length > 0) {
            buttonGroup.remove(buttonGroup.children[0]);
        }

        if (currentItems.length === 0) {
            buttonGroup.add("statictext", undefined, "No utility scripts found.");
            panel.layout.layout(true);
            return;
        }

        var availableWidth = 260;
        try {
            if (panel.size && panel.size.width) availableWidth = panel.size.width - 24;
        } catch (e) {}

        var row = null;
        var usedWidth = 0;

        for (var i = 0; i < currentItems.length; i++) {
            var item = currentItems[i];
            if (!row || usedWidth + FLOW_SPACING + item.width > availableWidth) {
                row = buttonGroup.add("group");
                row.orientation = "row";
                row.alignChildren = ["left", "center"];
                row.spacing = FLOW_SPACING;
                usedWidth = 0;
            }
            item.build(row);
            usedWidth += (usedWidth > 0 ? FLOW_SPACING : 0) + item.width;
        }

        panel.layout.layout(true);
    }

    // Re-scans the utilities folder and rebuilds the cached item list, then flows it.
    function refresh() {
        currentItems = [];

        var utilFolder = getUtilitiesFolder();
        if (!utilFolder.exists) {
            while (buttonGroup.children.length > 0) buttonGroup.remove(buttonGroup.children[0]);
            buttonGroup.add("statictext", undefined, "No \"" + UTILITIES_FOLDER_NAME + "\" folder found next to this script.");
            panel.layout.layout(true);
            return;
        }

        var files = utilFolder.getFiles("*.jsx");
        if (!files) files = [];

        files.sort(function (a, b) {
            return a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1;
        });

        var copyFile = null, pasteFile = null, rest = [];
        for (var i = 0; i < files.length; i++) {
            var base = files[i].displayName.replace(/\.jsx$/i, "");
            if (base === "Copy Ease") copyFile = files[i];
            else if (base === "Paste Ease") pasteFile = files[i];
            else rest.push(files[i]);
        }

        if (copyFile && pasteFile) {
            currentItems.push(makePairItem(copyFile, pasteFile));
        } else {
            if (copyFile) currentItems.push(makeSingleItem(copyFile));
            if (pasteFile) currentItems.push(makeSingleItem(pasteFile));
        }
        for (var r = 0; r < rest.length; r++) {
            currentItems.push(makeSingleItem(rest[r]));
        }

        layoutFlow();
        // layoutFlow() is also called from the resize handler, which already does its own
        // .resize() around it -- calling it again there could cascade. Only needed here, for the
        // "refresh list" link path, to match what "reload script" does and keep the right-aligned
        // header links from drifting left after the button list changes.
        panel.layout.resize();
    }

    refresh();

    panel.layout.layout(true);
    panel.layout.resize();
    panel.onResizing = panel.onResize = function () {
        this.layout.resize();
        layoutFlow();
    };

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
