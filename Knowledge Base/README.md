# Knowledge Base

Reusable, validated reference notes for Adobe After Effects & Premiere Pro automation,
copied from the working memory so they travel with this repo.

| File | What's in it |
|------|--------------|
| [reference_ae_expressions.md](reference_ae_expressions.md) | Validated AE expressions we've authored — purpose, code, and gotchas (line-limit, follow-text size, pin-edge grow, baseline pin, line-scaled start keyframes, null-as-global-offset, etc.) |
| [reference_ae_egp_scripting.md](reference_ae_egp_scripting.md) | AE Essential Graphics Panel scripting — EGP control via script, comp-change detection limits, scheduleTask polling |
| [reference_ae_pseudo_dropdown.md](reference_ae_pseudo_dropdown.md) | AE pseudo-effect dropdown editing — reading items, the matchName/display-name reset gotcha |
| [reference_ppro_scripting.md](reference_ppro_scripting.md) | Premiere Pro ExtendScript API reference — object model, methods, patterns, AE differences |
| [reference_ppro_uxp.md](reference_ppro_uxp.md) | Premiere Pro UXP plugin API — modern ES6+ platform, action pattern, UI framework, dev tools |

**Note:** These mirror the auto-memory `reference_*.md` files. A PostToolUse hook in
`.claude/settings.local.json` (local-only, not committed) re-copies each one here
automatically whenever it's edited in memory. On a machine without that hook, re-copy manually.
