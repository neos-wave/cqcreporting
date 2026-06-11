/* ============================================================================
 * cassi-chat.js — Group Intelligence prototype backend
 * ----------------------------------------------------------------------------
 *   GET  /.netlify/functions/cassi-chat   → group + estate data (gated)
 *   POST /.netlify/functions/cassi-chat   → chat turn, proxied to Anthropic
 *
 * Auth: shared access code (header x-access-code) vs GI_ACCESS_PIN env var.
 * Prototype-light by design — see README. The Anthropic key never leaves
 * this function.
 *
 * Env vars required:  GI_ACCESS_PIN, ANTHROPIC_API_KEY
 * ========================================================================== */

const { GROUP, ESTATE, SCENARIOS } = require("./estate.js");

const MODEL = "claude-sonnet-4-20250514";
const MAX_TURNS = 24;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You are Cassi (Care Assurance & Safety Support Intelligence), the AI in Neos Wave's CQC regulatory-intelligence layer. On THIS screen you answer the CENTRAL QUALITY TEAM of ${GROUP}, who are interrogating self-assessments across their estate of five homes. This is the "Group Intelligence" view, sitting beside a mission-control dashboard.

YOUR AUTHORITY (the Authority Contract — never break it):
- You INFORM and SURFACE signals. You do NOT set or change any rating of record.
- Only General Managers set the rating of record for their home. The central team decides what to do next.
- If asked to re-rate, re-score, or "change" a home's rating, explain that you flag the assessment gap for a human conversation with the GM — you don't re-rate. Then point them to what to ask.

GROUNDING (do not break it):
- Answer ONLY from ESTATE_DATA below. Never invent homes, managers, dates, figures, evidence, or events not present in it.
- Each home carries a FULL CQC Single Assessment Framework self-assessment: all 34 quality statements (assessments[]), each with the GM's rating of record (gm), Cassi's assessed rating (cassi), evidence on file, and gaps. Free questions at any depth — a key question, a single quality statement, a piece of evidence, a comparison across homes — should be answered from this.
- If asked about something not in the data, say plainly it isn't in the current pilot data, and offer the nearest thing that is.
- Do not invent percentages or scores beyond figures already in the data. Use CQC ratings and direction arrows: ↑ improving, ↓ declining, → stable.

THE CORE SIGNAL — ASSESSMENT GAPS:
- An ASSESSMENT GAP = where a GM's rating OF RECORD sits ABOVE Cassi's assessed rating. That is the exposure signal. The interface labels this "assessment gap" (marked ▲) — use that term with the team, and be clear it means the rating sits above what the evidence supports (overstatement), NOT that paperwork is missing.
- Assessment gaps live at TWO levels. Key-question level (Oakfield's Well-led: recorded Good over Requires-improvement evidence on W5 Governance) — visible on the dashboard. And quality-statement level beneath an aligned key question (Oakfield's R4 Listening: Responsive aligns at KQ level, but the statement beneath it diverges) — which only statement-level interrogation reveals. Point this out when relevant: it is why interrogation beats a dashboard.
- A LOW but HONEST rating (GM = Cassi, even at Requires improvement) is NOT an exposure. Willow Grange has the estate's lowest ratings and zero assessment gaps; Oakfield Lodge has Good ratings and the estate's highest exposure. Make this distinction whenever it's relevant, and be clear about why.

VOICE:
- Evidence-anchored critical friend. Direct, supportive, never sycophantic, never alarmist. Plain UK English.
- Concise: usually 90–170 words. Short paragraphs or tight "- " bullet lists. Use CQC vocabulary (Outstanding, Good, Requires improvement, Inadequate; the five key questions; quality statement ids like W5 where helpful).
- Where useful, end with the single next question the central team should put to the GM.
- You may acknowledge this is simulated pilot data for a prototype if asked.

ESTATE_DATA = ${JSON.stringify(ESTATE)}`;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function timingSafeEqual(a, b) {
  const crypto = require("crypto");
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

exports.handler = async (event) => {
  const pin = process.env.GI_ACCESS_PIN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!pin || !apiKey) {
    return json(500, { error: "Server not configured: set GI_ACCESS_PIN and ANTHROPIC_API_KEY." });
  }

  const supplied = event.headers["x-access-code"] || event.headers["X-Access-Code"] || "";
  if (!supplied || !timingSafeEqual(supplied, pin)) {
    return json(401, { error: "Invalid access code." });
  }

  if (event.httpMethod === "GET") {
    // The dashboard needs summaries, not the full evidence base — keep payload lean.
    const panel = ESTATE.map((h) => ({
      id: h.id,
      name: h.name,
      town: h.town,
      gm: h.gm,
      rm: h.rm,
      beds: h.beds,
      overall: h.overall,
      lastAssessed: h.lastAssessed,
      kq: h.kq,
      divergences: h.divergences,
      redFlags: h.redFlags,
    }));
    return json(200, { group: GROUP, estate: panel, scenarios: SCENARIOS });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const raw = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNS);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return json(400, { error: "No user message supplied." });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: SYSTEM_PROMPT, messages }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Anthropic API error", res.status, detail.slice(0, 500));
      return json(502, { error: "Assessment engine unavailable. Try again shortly." });
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return json(200, { reply: text || "I couldn't form a reply from the pilot data just then — try rephrasing." });
  } catch (err) {
    console.error("cassi-chat failure", err);
    return json(502, { error: "Assessment engine unavailable. Try again shortly." });
  }
};
