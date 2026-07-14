var csInterface = new CSInterface();
var MOGRT_DEFS = {}; // capsuleName -> { sourceFile, controls: [{name, type, options?, min?, max?}] }

(function loadDefs() {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "./js/mogrt-definitions.json", false); // sync — small local file
        xhr.send(null);
        MOGRT_DEFS = JSON.parse(xhr.responseText);
    } catch (e) {
        console.error("Failed to load mogrt-definitions.json", e);
    }
})();

function setStatus(msg) {
    document.getElementById("status").textContent = msg;
}

function showResults(obj) {
    document.getElementById("results").textContent = JSON.stringify(obj, null, 2);
}

function refreshState() {
    csInterface.evalScript("activeState()", function (result) {
        try {
            var d = JSON.parse(result);
            document.getElementById("seqName").textContent = d.sequenceName || "(none)";
            document.getElementById("selCount").textContent = (d.selectedCount != null) ? d.selectedCount : "0";
        } catch (e) {
            setStatus("Error reading state: " + result);
        }
    });
}

// "/path/.../Intro.aegraphic" -> "Intro"
function capsuleNameFromMediaPath(mediaPath) {
    if (!mediaPath) return null;
    var base = mediaPath.split(/[\\/]/).pop();
    return base.replace(/\.[^.]+$/, "");
}

// Real control definition for a param, from the extracted MOGRT metadata — or null if unknown.
function lookupParamDef(capsuleName, paramName) {
    var def = MOGRT_DEFS[capsuleName];
    if (!def) return null;
    for (var i = 0; i < def.controls.length; i++) {
        if (def.controls[i].name === paramName) return def.controls[i];
    }
    return null;
}

function findParam(clip, paramName) {
    for (var c = 0; c < clip.components.length; c++) {
        var comp = clip.components[c];
        for (var p = 0; p < comp.params.length; p++) {
            if (comp.params[p].name === paramName) return comp.params[p];
        }
    }
    return null;
}

function commonValue(clips, paramName) {
    var found = false, common = null, mixed = false;
    for (var i = 0; i < clips.length; i++) {
        var param = findParam(clips[i], paramName);
        if (!param) continue;
        if (!found) { common = param.value; found = true; }
        else if (param.value !== common) { mixed = true; }
    }
    if (!found) return { found: false };
    return { found: true, mixed: mixed, value: common };
}

// Collects every Capsule (MOGRT-exposed) param name across all selected clips, each enriched
// with its real control definition (type/options/min/max) when the clip's template is known.
function collectCapsuleParams(clips) {
    var byName = {}; // name -> { name, liveValueType, paramDef }
    for (var i = 0; i < clips.length; i++) {
        var clip = clips[i];
        var capsuleName = capsuleNameFromMediaPath(clip.projectItemMediaPath);
        for (var c = 0; c < clip.components.length; c++) {
            if (clip.components[c].matchName !== "AE.ADBE Capsule") continue;
            var params = clip.components[c].params;
            for (var p = 0; p < params.length; p++) {
                var name = params[p].name;
                if (!byName[name]) {
                    byName[name] = {
                        name: name,
                        liveValueType: params[p].valueType,
                        paramDef: capsuleName ? lookupParamDef(capsuleName, name) : null
                    };
                } else if (!byName[name].paramDef && capsuleName) {
                    byName[name].paramDef = lookupParamDef(capsuleName, name);
                }
            }
        }
    }
    var out = [];
    for (var k in byName) out.push(byName[k]);
    return out;
}

function sanitizeId(name) {
    return "dyn_" + name.replace(/[^a-zA-Z0-9]/g, "_");
}

function applyParam(paramName, value, buttonEl) {
    var originalText = buttonEl.textContent;
    buttonEl.textContent = "...";
    csInterface.evalScript(
        "applyToSelection(" + JSON.stringify(paramName) + ", " + JSON.stringify(value) + ")",
        function (result) {
            buttonEl.textContent = originalText;
            try {
                var d = JSON.parse(result);
                if (d.error) { setStatus("Error: " + d.error); return; }
                setStatus("Set '" + paramName + "' on " + d.setCount + " clip(s)" + (d.skipCount ? (", skipped " + d.skipCount) : "") + ".");
            } catch (e) {
                setStatus("Parse error applying " + paramName);
            }
        }
    );
}

// Control-kind numeric codes from MOGRT definition.json
var CTRL = { CHECKBOX: 1, SLIDER: 2, TEXT: 6, DROPDOWN: 13 };

function buildDropdown(container, id, pinfo, cv) {
    var options = pinfo.paramDef.options;
    var optionsHtml = "";
    for (var i = 0; i < options.length; i++) {
        optionsHtml += '<option value="' + i + '">' + options[i] + "</option>";
    }
    var block = document.createElement("div");
    block.className = "control-block";
    block.innerHTML =
        '<div class="control-title">' + pinfo.name + "</div>" +
        '<div class="control-row">' +
        '<select id="' + id + '">' + optionsHtml + "</select>" +
        '<div role="button" id="' + id + '_apply">Apply</div>' +
        "</div>";
    container.appendChild(block);
    var select = document.getElementById(id);
    if (cv.found && !cv.mixed) select.value = String(cv.value);
    document.getElementById(id + "_apply").addEventListener("click", function (name, selectEl) {
        return function () { applyParam(name, parseInt(selectEl.value, 10), this); };
    }(pinfo.name, select));
}

function buildSlider(container, id, pinfo, cv) {
    var min = (pinfo.paramDef && pinfo.paramDef.min != null) ? pinfo.paramDef.min : 0;
    var max = (pinfo.paramDef && pinfo.paramDef.max != null) ? pinfo.paramDef.max : 100;
    var block = document.createElement("div");
    block.className = "control-block";
    block.innerHTML =
        '<div class="control-title">' + pinfo.name + "</div>" +
        '<div class="control-row">' +
        '<input type="range" id="' + id + '_slider" min="' + min + '" max="' + max + '" step="1" />' +
        '<input type="number" id="' + id + '" min="' + min + '" max="' + max + '" step="1" />' +
        '<div role="button" id="' + id + '_apply">Apply</div>' +
        "</div>";
    container.appendChild(block);
    var slider = document.getElementById(id + "_slider");
    var num = document.getElementById(id);
    if (cv.found && !cv.mixed) { slider.value = cv.value; num.value = cv.value; }
    slider.addEventListener("input", function () { num.value = this.value; });
    num.addEventListener("input", function () { slider.value = this.value; });
    document.getElementById(id + "_apply").addEventListener("click", function (name, inputEl) {
        return function () { applyParam(name, parseFloat(inputEl.value), this); };
    }(pinfo.name, num));
}

function buildCheckbox(container, id, pinfo, cv) {
    var block = document.createElement("div");
    block.className = "control-block";
    block.innerHTML =
        '<div class="control-title">' + pinfo.name + "</div>" +
        '<div class="control-row">' +
        '<input type="checkbox" id="' + id + '" />' +
        '<div role="button" id="' + id + '_apply">Apply</div>' +
        "</div>";
    container.appendChild(block);
    var cb = document.getElementById(id);
    if (cv.found) {
        if (cv.mixed) cb.indeterminate = true;
        else cb.checked = !!cv.value;
    }
    document.getElementById(id + "_apply").addEventListener("click", function (name, checkboxEl) {
        return function () { applyParam(name, checkboxEl.checked, this); };
    }(pinfo.name, cb));
}

function buildFallbackNumber(container, id, pinfo, cv) {
    var block = document.createElement("div");
    block.className = "control-block";
    block.innerHTML =
        '<div class="control-title">' + pinfo.name + ' <span style="color:#777;">(unknown template — raw value)</span></div>' +
        '<div class="control-row">' +
        '<input type="number" id="' + id + '" step="1" />' +
        '<div role="button" id="' + id + '_apply">Apply</div>' +
        "</div>";
    container.appendChild(block);
    var numInput = document.getElementById(id);
    if (cv.found && !cv.mixed) numInput.value = cv.value;
    document.getElementById(id + "_apply").addEventListener("click", function (name, inputEl) {
        return function () { applyParam(name, parseFloat(inputEl.value), this); };
    }(pinfo.name, numInput));
}

function buildDynamicControls(clips) {
    var container = document.getElementById("dynamicControls");
    container.innerHTML = "";

    var capsuleParams = collectCapsuleParams(clips);
    for (var i = 0; i < capsuleParams.length; i++) {
        var pinfo = capsuleParams[i];
        var id = sanitizeId(pinfo.name);
        var cv = commonValue(clips, pinfo.name);
        var kind = pinfo.paramDef ? pinfo.paramDef.type : null;

        if (kind === CTRL.DROPDOWN) {
            buildDropdown(container, id, pinfo, cv);
        } else if (kind === CTRL.SLIDER) {
            buildSlider(container, id, pinfo, cv);
        } else if (kind === CTRL.CHECKBOX) {
            buildCheckbox(container, id, pinfo, cv);
        } else if (kind === CTRL.TEXT) {
            continue; // rich-text blob — not editable here
        } else if (pinfo.liveValueType === "boolean") {
            buildCheckbox(container, id, pinfo, cv); // unknown template, but type is unambiguous
        } else if (pinfo.liveValueType === "number") {
            buildFallbackNumber(container, id, pinfo, cv); // unknown template — best effort
        }
        // string/object with no config match: skip, not safely editable
    }
}

function populateControls(clips) {
    buildDynamicControls(clips);
    document.getElementById("controls").style.display = "block";
}

document.getElementById("refreshBtn").addEventListener("click", refreshState);

document.getElementById("scanBtn").addEventListener("click", function () {
    setStatus("Scanning...");
    csInterface.evalScript("discover()", function (result) {
        try {
            var d = JSON.parse(result);
            if (d.error) {
                setStatus("Error: " + d.error);
                showResults(d);
                return;
            }
            setStatus("Scanned " + d.count + " clip(s).");
            showResults(d);
            populateControls(d.clips);
        } catch (e) {
            setStatus("Parse error");
            showResults({ raw: result });
        }
    });
});

document.getElementById("showJsonBtn").addEventListener("click", function () {
    var el = document.getElementById("results");
    el.style.display = (el.style.display === "none" || !el.style.display) ? "block" : "none";
});

refreshState();
