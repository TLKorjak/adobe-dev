// Copy Ease — AE Toolbar utility script.
// Run: normally launched from the "Copy Ease" button in AE_Toolbar.jsx, one folder up.
//      Can also be run standalone via File > Scripts > Run Script File...
//
// Select exactly one keyframe (the one showing the ease values you want, e.g. in the Keyframe
// Velocity dialog) and run this to store its temporal ease (Easy Ease in/out — influence + speed,
// per dimension) in memory. Then select any other keyframe(s) and run "Paste Ease" to apply it.
// The copied ease stays available for the rest of this AE session (or until you Copy Ease again).

(function () {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Copy Ease: no active composition.");
            return;
        }

        var props = comp.selectedProperties;
        var found = null; // { prop, keyIndex }

        for (var p = 0; p < props.length; p++) {
            var prop = props[p];
            if (!(prop instanceof Property) || !prop.isTimeVarying) continue;
            var selKeys = prop.selectedKeys;
            if (!selKeys || selKeys.length === 0) continue;

            for (var k = 0; k < selKeys.length; k++) {
                if (found) {
                    alert("Copy Ease: select exactly ONE keyframe to copy from (found more than one selected).");
                    return;
                }
                found = { prop: prop, keyIndex: selKeys[k] };
            }
        }

        if (!found) {
            alert("Copy Ease: select exactly one keyframe first, then run this.");
            return;
        }

        var inEase = found.prop.keyInTemporalEase(found.keyIndex);
        var outEase = found.prop.keyOutTemporalEase(found.keyIndex);

        // store plain copies, not live references, so later edits to the source keyframe
        // can't retroactively change what was copied
        var storedIn = [];
        var storedOut = [];
        for (var d = 0; d < inEase.length; d++) storedIn.push(new KeyframeEase(inEase[d].speed, inEase[d].influence));
        for (var d2 = 0; d2 < outEase.length; d2++) storedOut.push(new KeyframeEase(outEase[d2].speed, outEase[d2].influence));

        $.global.__aeToolbarCopiedEase = { inEase: storedIn, outEase: storedOut };
    } catch (e) {
        alert("Copy Ease error: " + e.toString() + (e.line ? " (line " + e.line + ")" : ""));
    }
})();
