# TC Markers — Install Guide (Premiere Pro 2026)

A dockable panel that reads a transcript **.docx**, finds the **yellow-highlighted
syncs**, and drops a colored **comment marker** on the active sequence for each one
(default **red**, comment = first 5 words of the highlight).

---

## Requirements
- **Adobe Premiere Pro 2026** (version 25.6 or newer).
- **Adobe Creative Cloud desktop app** installed (it provides the installer — the
  *Unified Plugin Installer Agent*, "UPIA"). No separate download needed.

---

## Install

1. Unzip this package. You'll have `tc-markers.ccx` and this `INSTALL.md`.

2. **Right-click `tc-markers.ccx` → Open With → `UnifiedPluginInstallerAgent.app`.**
   - If it isn't in the list: **Open With → Other…**, then browse to it (see paths below),
     or simply **double-click** `tc-markers.ccx`.

3. The Unified Plugin Installer window opens → click **Install**.

4. (First time only) If install is blocked because the plugin is self-signed, enable
   **Developer Mode** in Premiere: **Premiere Pro → Settings → Plugins → Enable
   Developer Mode**, restart Premiere, then install again.

5. Launch (or restart) Premiere Pro. Open the panel from
   **Window → Extensions → TC Markers** and dock it anywhere.

### Where the installer lives (if you need to browse to it)
- **macOS:** `/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app`
- **Windows:** `C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe`

---

## Use

1. Open your project and make the **target sequence active** — the panel shows its
   name at the top (use **↻** to refresh if you switch sequences).
2. Click the **upload area** and choose your transcript **`.docx`**. The panel reports
   how many highlighted syncs / timecode rows it found.
3. Pick a **Marker Color** (default Red) and click **Process Markers**.
4. Markers are **added** to the sequence (existing markers are left in place).

---

## Notes
- The `.docx` must contain a table where each row carries a timecode, and the syncs you
  want marked are **highlighted** in any color (Word highlight or Google-Docs/Word
  shading — any color counts). Non-highlighted rows are ignored.
- Timecodes are interpreted at **25 fps** and offset by the sequence's start time.
- To **update** to a newer build, install the new `.ccx` the same way.

---

## Uninstall
Open `UnifiedPluginInstallerAgent.app`, find **TC Markers** in the list, and click **Remove**.
