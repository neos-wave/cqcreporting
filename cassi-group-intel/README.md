# Cassi — Group Intelligence (standalone prototype)

A shareable prototype of the **Group Intelligence** view: a mission-control
dashboard plus a chat where a central quality team interrogates
self-assessments across **Brackenford Care Group** — a fictional estate of
five homes, each carrying a **full CQC Single Assessment Framework
self-assessment (all 34 quality statements, 170 records)**.

Standalone by design — it merges into the live product later. The group name
is one constant (`GROUP` in `netlify/functions/estate.js`) if you want a
different fiction.

## What it demonstrates

- **CQC is the fixed baseline.** Cassi is a *mock assessor*: every quality
  statement carries her assessed rating alongside the GM's rating of record.
- **The GM owns the rating of record.** Cassi never sets or changes it; ask
  her to re-rate and she'll decline and hand you the question for the GM.
- **Divergence is the signal — at two levels.** Oakfield's Well-led (W5
  Governance) diverges at key-question level and shows on the board. Its
  Listening statement (R4) diverges *beneath an aligned Responsive rating* —
  only interrogation reveals it. That's the product argument in one click.
- **Honest-low ≠ exposure.** Willow Grange has the estate's lowest ratings and
  zero divergence; Oakfield has Good ratings and the estate's highest
  exposure. The data is built to teach exactly that distinction.

## The screen

Left: **mission control** — KPI strip, a homes × key-questions heatmap of
ratings of record (▲ marks recorded-above-assessment), an exposure list, and
a watch list. Every cell, home and list item is tappable and turns into a
question to Cassi. Right: **chat**, with the four scenario starters.

## The four tester scenarios

1. **"Where's my biggest exposure right now?"** → Oakfield: Good recorded over
   Requires-improvement governance evidence (W5), contrasted with honest-low
   Willow Grange.
2. **"Which homes are improving, and which are slipping?"** → Meadowbrook ↑,
   Thornbury ↓ on Caring (honest downgrade, rooted in 22% turnover), others
   stable.
3. **"Walk me through Meadowbrook's journey since March."** → S8 Medicines:
   Requires improvement in March (self-raised), Good in May with the evidence
   to carry it.
4. **"Where are GMs recording above Cassi's assessment?"** → the two-level
   divergence report (W5 on the board; R4 hiding beneath an aligned key
   question).

Free questions work at any depth — "compare safeguarding across the estate",
"what's the evidence behind Riverside's person-centred care", "which homes
have a medicines problem" — because the full statement-level assessments are
in Cassi's grounding.

## Deploy (Netlify)

1. Push this folder to a new GitHub repo (e.g. `neos-wave/cassi-group-intel`).
2. Netlify: **Add new site → Import from GitHub**. `netlify.toml` sets the
   publish dir (`public`) and functions dir — no build command.
3. Environment variables:
   - `GI_ACCESS_PIN` — the access code you'll give testers (any string)
   - `ANTHROPIC_API_KEY` — your existing key
4. Share the URL + the code.

Keep it off the apex (marketing) and off `app.` (live product).

## Structure

```
netlify.toml
public/index.html               — frontend (vanilla JS, no build step)
netlify/functions/estate.js     — the simulated estate: SINGLE SOURCE OF TRUTH
netlify/functions/cassi-chat.js — gated proxy to the Anthropic API
```

`estate.js` generates the 170 records by merging per-home story overrides
onto a coherent baseline, then **computes** the divergence list from the
ratings — the board, the lists and Cassi's answers can never disagree. The
dashboard receives a lean summary; the full evidence base lives server-side
in Cassi's grounding only.

## Honest limitations (say these to testers)

- **Everything is invented placeholder data** — homes, people, evidence. The
  fiction is internally consistent but is not a real estate.
- **Auth is a shared access code**, not per-user accounts. Fine for a trial;
  RBAC stays on the main-product roadmap. Rotate `GI_ACCESS_PIN` after.
- No persistence: refresh = fresh conversation (deliberate, so sequential
  testers start clean).
- The function caps message length and history depth to limit cost if the
  code leaks; the Anthropic key never reaches the browser.
