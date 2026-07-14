// MOGRT Batch Controller — ExtendScript host (classic ExtendScript, PPro CEP)

function writeDebugFile(jsonStr) {
    try {
        var f = new File("/tmp/mogrt-batch-controller-result.json");
        f.encoding = "UTF-8";
        f.open("w");
        f.write(jsonStr);
        f.close();
    } catch (e) {
        try {
            var ef = new File("/tmp/mogrt-batch-controller-result.json");
            ef.encoding = "UTF-8";
            ef.open("w");
            ef.write('{"writeDebugFileError":"' + e.toString().replace(/"/g, "'") + '"}');
            ef.close();
        } catch (e2) {}
    }
}

function activeState() {
    var seq = app.project.activeSequence;
    var out = { hasSequence: !!seq };
    if (seq) {
        out.sequenceName = seq.name;
        var sel = seq.getSelection();
        out.selectedCount = sel ? sel.length : 0;
    }
    var jsonStr = JSON.stringify(out);
    writeDebugFile(jsonStr);
    return jsonStr;
}

// Dumps every component/param on every selected clip. Read-only, safe.
function discover() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) {
            var errJson = JSON.stringify({ error: "No active sequence" });
            writeDebugFile(errJson);
            return errJson;
        }
        var sel = seq.getSelection();
        var results = [];
        for (var i = 0; i < sel.length; i++) {
            var item = sel[i];
            var rec = { name: item.name, components: [] };
            try {
                rec.projectItemMediaPath = item.projectItem ? item.projectItem.getMediaPath() : null;
            } catch (eMedia) { rec.projectItemMediaPathError = eMedia.toString(); }
            var comps = item.components;
            if (!comps) { results.push(rec); continue; }
            for (var c = 0; c < comps.numItems; c++) {
                var comp = comps[c];
                var compRec = { index: c, name: comp.displayName, matchName: comp.matchName, params: [] };
                var props = comp.properties;
                for (var p = 0; p < props.numItems; p++) {
                    var param = props[p];
                    var paramRec = { index: p, name: param.displayName };
                    try {
                        var val = param.getValue();
                        paramRec.value = val;
                        paramRec.valueType = typeof val;
                    } catch (e) {
                        paramRec.getValueError = e.toString();
                    }
                    try { paramRec.areKeyframesSupported = param.areKeyframesSupported(); } catch (e2) {}
                    compRec.params.push(paramRec);
                }
                rec.components.push(compRec);
            }
            results.push(rec);
        }
        var out = { success: true, count: results.length, clips: results };
        var jsonStr = JSON.stringify(out);
        writeDebugFile(jsonStr);
        return jsonStr;
    } catch (e) {
        var errJson2 = JSON.stringify({ error: e.toString(), line: e.line });
        writeDebugFile(errJson2);
        return errJson2;
    }
}

// Set a named param (by displayName) to a value, on every selected clip that has it.
// paramName: string, value: number|string
function applyToSelection(paramName, value) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });
        var sel = seq.getSelection();
        var setCount = 0, skipCount = 0, names = [];
        for (var i = 0; i < sel.length; i++) {
            var item = sel[i];
            var comps = item.components;
            if (!comps) { skipCount++; continue; }
            var found = false;
            for (var c = 0; c < comps.numItems; c++) {
                var props = comps[c].properties;
                for (var p = 0; p < props.numItems; p++) {
                    var param = props[p];
                    if (param.displayName === paramName) {
                        param.setValue(value, true);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) { setCount++; names.push(item.name); }
            else { skipCount++; }
        }
        var out = { success: true, setCount: setCount, skipCount: skipCount, names: names };
        var jsonStr = JSON.stringify(out);
        writeDebugFile(jsonStr);
        return jsonStr;
    } catch (e) {
        var errJson = JSON.stringify({ error: e.toString(), line: e.line });
        writeDebugFile(errJson);
        return errJson;
    }
}
