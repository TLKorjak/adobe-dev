// Paste Ease — AE Toolbar utility script.
// Run: normally launched from the "Paste Ease" button in AE_Toolbar.jsx, one folder up.
//      Can also be run standalone via File > Scripts > Run Script File...
//
// Applies the ease values most recently stored by "Copy Ease" to every currently selected
// keyframe (across one or more selected properties, even on different layers/properties).
// If the copied ease has fewer dimensions than a target property (e.g. copying from a 1D
// Rotation onto a 2D Position), the last copied dimension is reused to fill the rest; if it has
// more, the extra dimensions are dropped.

(function () {
    app.beginUndoGroup("Paste Ease");
    try {
        var copied = $.global.__aeToolbarCopiedEase;
        if (!copied) {
            alert("Paste Ease: nothing copied yet. Select a keyframe and run \"Copy Ease\" first.");
            return;
        }

        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Paste Ease: no active composition.");
            return;
        }

        var props = comp.selectedProperties;
        if (!props || props.length === 0) {
            alert("Paste Ease: select one or more keyframes to paste onto first.");
            return;
        }

        var totalUpdated = 0;

        for (var p = 0; p < props.length; p++) {
            var prop = props[p];
            if (!(prop instanceof Property) || !prop.isTimeVarying) continue;
            var selKeys = prop.selectedKeys;
            if (!selKeys || selKeys.length === 0) continue;

            var dim = prop.value instanceof Array ? prop.value.length : 1;
            var inEase = adaptDimensions(copied.inEase, dim);
            var outEase = adaptDimensions(copied.outEase, dim);

            for (var k = 0; k < selKeys.length; k++) {
                prop.setTemporalEaseAtKey(selKeys[k], inEase, outEase);
                totalUpdated++;
            }
        }

        if (totalUpdated === 0) {
            alert("Paste Ease: no selected keyframes found. Select the keyframe(s) to apply the copied ease to.");
        }
    } catch (e) {
        alert("Paste Ease error: " + e.toString() + (e.line ? " (line " + e.line + ")" : ""));
    } finally {
        app.endUndoGroup();
    }

    function adaptDimensions(easeArray, targetDim) {
        var out = [];
        for (var i = 0; i < targetDim; i++) {
            var src = easeArray[Math.min(i, easeArray.length - 1)];
            out.push(new KeyframeEase(src.speed, src.influence));
        }
        return out;
    }
})();
