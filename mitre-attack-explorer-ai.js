// AI retrofit for mitre-attack-explorer.html
// Drop-in module. Add to the existing HTML with:
//   <script type="module" src="mitre-attack-explorer-ai.js"></script>
//
// What it adds: a floating "Describe the behavior" panel that AI-maps a
// plain-English adversary behavior description to ranked techniques from
// the explorer's local 47-technique dataset, with one-click navigation to
// the host explorer's detail view.

import { askGeminiJSON, app as fbApp } from "./ai-config.js";

const css = `
.mx-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#f97316);border:none;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 22px rgba(239,68,68,.4);z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s}
.mx-fab:hover{transform:scale(1.08)}
.mx-panel{position:fixed;bottom:90px;right:24px;width:460px;max-width:calc(100vw - 48px);max-height:calc(100vh - 130px);background:#0f172a;border:1px solid #1e293b;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:9997;display:none;flex-direction:column;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
.mx-panel.open{display:flex}
.mx-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #1e293b}
.mx-head h3{font-size:14px;font-weight:600}
.mx-status{font-size:10px;display:flex;align-items:center;gap:5px;color:#94a3b8;background:#1a2332;padding:3px 9px;border-radius:10px}
.mx-dot{width:7px;height:7px;border-radius:50%;background:#64748b}
.mx-dot.ready{background:#22c55e}.mx-dot.unconfigured{background:#fbbf24}.mx-dot.error{background:#ef4444}
.mx-close{background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1}
.mx-body{padding:16px 18px;overflow-y:auto;flex:1}
.mx-body label{display:block;font-size:11px;color:#94a3b8;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.mx-body textarea{width:100%;background:#0a0e17;border:1px solid #1e293b;border-radius:6px;padding:10px 12px;color:#e2e8f0;font-size:13px;font-family:inherit;resize:vertical;min-height:80px}
.mx-go{background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;border:none;padding:9px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-top:12px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.mx-go:hover{filter:brightness(1.1)}
.mx-go:disabled{opacity:.5;cursor:not-allowed}
.mx-loading{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:mx-spin .6s linear infinite}
@keyframes mx-spin{to{transform:rotate(360deg)}}
.mx-error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:10px;border-radius:6px;font-size:12px;margin-top:10px}
.mx-match{background:#1a2332;border:1px solid #1e293b;border-radius:8px;padding:12px 14px;margin-top:10px}
.mx-match-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px}
.mx-match-id{font-family:'Cascadia Code',monospace;font-size:11px;color:#f97316;background:rgba(249,115,22,.1);padding:2px 8px;border-radius:5px}
.mx-match-name{font-weight:600;font-size:13px;color:#e2e8f0;flex:1}
.mx-conf{font-size:10px;font-weight:700;padding:3px 8px;border-radius:9px;text-transform:uppercase;letter-spacing:1px}
.mx-conf.high{background:rgba(34,197,94,.2);color:#22c55e}
.mx-conf.medium{background:rgba(251,191,36,.2);color:#fbbf24}
.mx-conf.low{background:rgba(100,116,139,.2);color:#94a3b8}
.mx-reasoning{font-size:12px;color:#94a3b8;line-height:1.55;margin:6px 0}
.mx-jump{background:#06b6d4;color:#0a0e17;border:none;padding:5px 11px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:4px}
.mx-jump:hover{filter:brightness(1.1)}
.mx-disclaimer{font-size:10px;color:#64748b;margin-top:10px;font-style:italic}
.mx-tactic-chip{font-size:10px;color:#94a3b8;background:#0a0e17;padding:2px 7px;border-radius:4px;margin-right:6px}
`;
const styleEl = document.createElement("style");
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ---------- Build technique catalog with tactic lookup ----------
function buildCatalog() {
  if (typeof TACTICS === "undefined") return { techs: [], tacticOf: {} };
  const tacticOf = {};
  const techs = [];
  TACTICS.forEach(t => {
    (t.techniques || []).forEach(tech => {
      tacticOf[tech.id] = t.id;
      techs.push({
        id: tech.id,
        name: tech.name,
        desc: tech.desc,
        tactic: t.name,
        platforms: tech.platforms,
        severity: tech.severity,
        subtechCount: (tech.subtechniques || []).length
      });
    });
  });
  return { techs, tacticOf };
}
const { techs: CATALOG, tacticOf: TACTIC_OF } = buildCatalog();

// ---------- UI ----------
const fab = document.createElement("button");
fab.className = "mx-fab"; fab.innerHTML = "🔎"; fab.title = "AI behavior → technique lookup";
document.body.appendChild(fab);

const panel = document.createElement("div");
panel.className = "mx-panel";
panel.innerHTML = `
  <div class="mx-head">
    <h3>🔎 AI technique finder</h3>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="mx-status"><span class="mx-dot" id="mx-dot"></span><span id="mx-text">…</span></div>
      <button class="mx-close" id="mx-close">✕</button>
    </div>
  </div>
  <div class="mx-body">
    <label>Describe an observed behavior or attack scenario</label>
    <textarea id="mx-q" placeholder="e.g., An attacker scheduled a PowerShell task that runs every hour and exfiltrates documents to a Discord webhook"></textarea>
    <button class="mx-go" id="mx-go">✨ Find techniques</button>
    <div id="mx-out"></div>
  </div>
`;
document.body.appendChild(panel);

fab.addEventListener("click", () => panel.classList.toggle("open"));
document.getElementById("mx-close").addEventListener("click", () => panel.classList.remove("open"));

(function checkAIStatus() {
  const dot = document.getElementById("mx-dot");
  const text = document.getElementById("mx-text");
  try {
    const cfg = fbApp.options || {};
    if (!cfg.projectId || cfg.projectId.startsWith("REPLACE_")) {
      dot.className = "mx-dot unconfigured"; text.textContent = "not configured";
    } else {
      dot.className = "mx-dot ready"; text.textContent = "ready";
    }
  } catch (e) { dot.className = "mx-dot error"; text.textContent = "error"; }
})();

function escapeHTML(s) { return String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

document.getElementById("mx-go").addEventListener("click", async () => {
  const out = document.getElementById("mx-out");
  const q = document.getElementById("mx-q").value.trim();
  if (!q) { out.innerHTML = `<div class="mx-error">Describe a behavior first.</div>`; return; }
  if (!CATALOG.length) { out.innerHTML = `<div class="mx-error">Couldn't read the technique catalog from this page.</div>`; return; }

  const btn = document.getElementById("mx-go");
  btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="mx-loading"></span> Searching…`;

  // Send a compact technique list (id + name + short desc + tactic) — keeps prompt small
  const catalogStr = CATALOG.map(t => `${t.id} · ${t.name} (${t.tactic}): ${t.desc.slice(0,120)}`).join("\n");

  const prompt = `You are mapping an observed adversary behavior to MITRE ATT&CK techniques. Pick the BEST matches from the catalog below — do not invent techniques that aren't listed.

OBSERVED BEHAVIOR:
"""${q}"""

CATALOG (use these IDs exactly):
${catalogStr}

Return JSON. Return 2-6 ranked matches, ordered most-relevant first. Confidence: high/medium/low. Reasoning should be specific to why THIS behavior maps to THAT technique. If the behavior maps to multiple tactics, include the top match from each.`;

  const schema = {
    type: "object",
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            technique_id: { type: "string" },
            confidence: { type: "string", enum: ["high","medium","low"] },
            reasoning: { type: "string" },
            sub_indicators: { type: "array", items: { type: "string" } }
          },
          required: ["technique_id","confidence","reasoning"]
        }
      },
      caveats: { type: "string" }
    },
    required: ["matches"]
  };

  const { data, error } = await askGeminiJSON(prompt, schema);
  btn.disabled = false; btn.innerHTML = btn.dataset.orig;

  if (error) { out.innerHTML = `<div class="mx-error">⚠ ${escapeHTML(error)}</div>`; return; }

  if (!data.matches?.length) {
    out.innerHTML = `<div class="mx-error">No matches found in the catalog.</div>`;
    return;
  }

  const cards = data.matches.map(m => {
    const tech = CATALOG.find(t => t.id === m.technique_id);
    if (!tech) return ""; // skip hallucinated IDs
    const tacticId = TACTIC_OF[m.technique_id];
    return `
      <div class="mx-match">
        <div class="mx-match-head">
          <div style="flex:1">
            <span class="mx-match-id">${escapeHTML(m.technique_id)}</span>
            <span class="mx-tactic-chip">${escapeHTML(tech.tactic)}</span>
            <div class="mx-match-name" style="margin-top:4px">${escapeHTML(tech.name)}</div>
          </div>
          <span class="mx-conf ${escapeHTML(m.confidence)}">${escapeHTML(m.confidence)}</span>
        </div>
        <div class="mx-reasoning">${escapeHTML(m.reasoning)}</div>
        ${m.sub_indicators?.length ? `<div class="mx-reasoning"><strong style="color:#06b6d4">Sub-indicators:</strong><ul style="margin-left:18px;margin-top:4px">${m.sub_indicators.map(s=>`<li>${escapeHTML(s)}</li>`).join("")}</ul></div>` : ""}
        <button class="mx-jump" data-tac="${escapeHTML(tacticId||"")}" data-tech="${escapeHTML(m.technique_id)}">→ Open in explorer</button>
      </div>`;
  }).join("");

  out.innerHTML = `
    ${cards}
    ${data.caveats ? `<div class="mx-reasoning" style="margin-top:12px"><strong style="color:#06b6d4">Caveats:</strong> ${escapeHTML(data.caveats)}</div>` : ""}
    <div class="mx-disclaimer">⚠ AI mapping. Verify by reading each technique's full description in the explorer before relying on the match.</div>`;

  out.querySelectorAll(".mx-jump").forEach(b => {
    b.addEventListener("click", () => {
      const tac = b.dataset.tac, tech = b.dataset.tech;
      if (typeof window.openDetail === "function" && tac && tech) {
        try { window.openDetail(tac, tech); panel.classList.remove("open"); }
        catch (e) { alert("Couldn't open detail view: " + e.message); }
      }
    });
  });
});
