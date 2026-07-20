// Normalizes a single "VOD Path segment" text layer (Autobus comp, and siblings using the
// same "Master text" / "privateControls" setup) to match the fixed reference (layer 164,
// "VOD Path 16 heb-eng"). Load as a dockable panel: place this file in
// After Effects/Scripts/ScriptUI Panels/, then Window > fix-vod-path-segment-layer.jsx.
// Select the target layer(s) on the timeline, click the button.
//
// Reference diff used to build this (layer 164 = after fix, layer 156 = before fix):
//   - direction: 10212 (before) -> 10213 (after)               -- RTL toggle
//   - justification: 7413 unchanged both sides                  -- LEFT_JUSTIFY is the base;
//     "Right align text" is still applied explicitly below since OTHER not-yet-fixed layers
//     may start from a different justification.
//   - animators: ["Animator 1","Animator 2"] (before) -> ["Animator 2"] (after)
//     -- "Animator 1" is confirmed (not guessed) to be the one to delete.
//   - source text expression: simple passthrough (before) -> full per-character styling
//     expression (after).
//
// TextDirection has no named enum exposed to ExtendScript (confirmed: `TextDirection` is
// undefined) -- 10213 is the raw value empirically read off the fixed reference layer.

#target aftereffects

function fixVodPathSegmentLayers() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { alert("No active composition."); return; }
    if (!comp.selectedLayers || comp.selectedLayers.length === 0) { alert("No layer selected."); return; }

    var sourceTextExpression =
        'var src = thisComp.layer("Show Name").text.sourceText;\n' +
        'var s = "" + src;\n' +
        '// base size for ALL chars first (createStyle starts empty; unsized chars would render at 0 and vanish)\n' +
        'var baseSize = src.fontSize || 46;\n' +
        'var styled = src.createStyle().setText(s).setFontSize(baseSize);\n' +
        '// English letters: UPPERCASE -> caps slider, lowercase -> slider. Hebrew keeps base size.\n' +
        'var enSizeLower = thisComp.layer("privateControls").effect("english font size")("Slider");\n' +
        'var enSizeCaps  = thisComp.layer("privateControls").effect("english font size caps")("Slider");\n' +
        'var enTracking  = thisComp.layer("privateControls").effect("english tracking")("Slider");\n' +
        'for (var i = 0; i < s.length; i++) {\n' +
        '    var c = s.charCodeAt(i);\n' +
        '    if (c >= 65 && c <= 90) {\n' +
        '        styled = styled.setFont("Montserrat-SemiBold", i, 1).setFontSize(enSizeCaps, i, 1).setTracking(enTracking, i, 1);\n' +
        '    } else if (c >= 97 && c <= 122) {\n' +
        '        styled = styled.setFont("Montserrat-Medium", i, 1).setFontSize(enSizeLower, i, 1).setTracking(enTracking, i, 1);\n' +
        '    }\n' +
        '}\n' +
        'styled;';

    app.beginUndoGroup("Fix VOD Path segment layer(s)");
    try {
        var reports = [];
        for (var li = 0; li < comp.selectedLayers.length; li++) {
            var layer = comp.selectedLayers[li];
            var report = "Layer: " + layer.name;

            // 1. parenting status (report), then un-parent -- keep the actual layer
            //    reference (not just its name) so it can be restored as the last step.
            var originalParent = layer.parent;
            report += "\n  parent before: " + (originalParent ? originalParent.name : "(none)");
            layer.parent = null;

            // 2. transform scale -> 100,100
            var scaleProp = layer.property("ADBE Transform Group").property("ADBE Scale");
            var oldScale = scaleProp.value;
            scaleProp.setValue([100, 100, oldScale.length > 2 ? oldScale[2] : 100]);
            report += "\n  scale: " + oldScale.join(",") + " -> 100,100";

            // 3. delete "Animator 1" (the scale animator) -- confirmed via before/after diff,
            //    NOT a guess. Iterate backwards so removal doesn't shift indices mid-loop.
            var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
            var removed = false;
            for (var a = animators.numProperties; a >= 1; a--) {
                if (animators.property(a).name === "Animator 1") {
                    animators.property(a).remove();
                    removed = true;
                }
            }
            report += "\n  deleted 'Animator 1': " + removed;

            // 4-6. paragraph fixes -- reset MUST come first: resetParagraphStyle() clears
            // justification/direction back to defaults, so setting them beforehand gets wiped.
            //
            // NOTE on justification: AE's enum is relative to READING ORDER, not the screen.
            // Confirmed against the fixed reference (layer 164, Autobus): its justification
            // is LEFT_JUSTIFY (7413), not RIGHT_JUSTIFY (7414) -- with direction set to RTL,
            // "align to the start of reading order" (LEFT_JUSTIFY) is what visually renders
            // as right-aligned in the Paragraph panel. Setting RIGHT_JUSTIFY here was the bug:
            // it visually flipped to LEFT-aligned once direction was RTL.
            var textDocProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
            var doc = textDocProp.value;
            doc.resetParagraphStyle();                               // "Reset Paragraph"
            doc.direction = 10213;                                   // "Right to left text direction"
            doc.justification = ParagraphJustification.LEFT_JUSTIFY; // "Right align text" (visually, under RTL)
            textDocProp.setValue(doc);

            // 7. apply the per-character styling expression to Source Text
            textDocProp.expression = sourceTextExpression;

            // 8. restore the original parent as the last step
            layer.parent = originalParent;
            report += "\n  parent restored: " + (originalParent ? originalParent.name : "(none)");

            reports.push(report);
        }
        alert(reports.join("\n\n"));
    } catch (e) {
        alert("Error: " + e.toString() + " (line " + e.line + ")");
    }
    app.endUndoGroup();
}

function buildUI(thisObj) {
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Fix VOD Path Layer", undefined, { resizeable: true });
    panel.orientation = "column";
    panel.alignChildren = ["fill", "top"];
    panel.spacing = 8;
    panel.margins = 12;

    var btn = panel.add("button", undefined, "Fix Selected Layer(s)");
    btn.onClick = fixVodPathSegmentLayers;

    panel.layout.layout(true);
    panel.layout.resize();
    panel.onResizing = panel.onResize = function () { this.layout.resize(); };

    return panel;
}

var vodPathFixerPanel = buildUI(this);
if (vodPathFixerPanel instanceof Window) {
    vodPathFixerPanel.center();
    vodPathFixerPanel.show();
}
