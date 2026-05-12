// AI retrofit for threat-modeling-workbench.html
// Drop-in module. Add to the existing HTML with:
//   <script type="module" src="threat-modeling-workbench-ai.js"></script>
//
// The host workbench is a vanilla-JS SPA that re-renders #app on every change,
// so this retrofit lives in its OWN floating panel anchored to the viewport.
// It reads the global `state` object (project, threats, selectedStride, dreadScores, attackTree).
//
// Capabilities:
//   • Suggest threats — given project scope + selected STRIDE categories, AI proposes specific threats
//   • DREAD-score — given current threats, AI estimates DREAD scores per threat
//   • Draft attack tree — given a top-level adversary goal, AI proposes child nodes (AND/OR logic)

import { askGemini, askGeminiJSON, app as fbApp } from "./ai-config.js";

// ---------- Style injection ----------
const css = `
.tm-ai-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#06b6d4);border:none;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 22px rgba(168,85,247,.4);z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s}
.tm-ai-fab:hover{transform:scale(1.08)}
.tm-ai-panel{position:fixed;bottom:90px;right:24px;width:440px;max-width:calc(100vw - 48px);max-height:calc(100vh - 130px);background:#0f172a;border:1px solid #1e293b;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:9997;display:none;flex-direction:column;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
.tm-ai-panel.open{display:flex}
.tm-ai-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #1e293b}
.tm-ai-head h3{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.tm-ai-status{font-size:10px;display:flex;align-items:center;gap:5px;color:#94a3b8;background:#1a2332;padding:3px 9px;border-radius:10px}
.tm-ai-dot{width:7px;height:7px;border-radius:50%;background:#64748b}
.tm-ai-dot.ready{background:#22c55e}.tm-ai-dot.unconfigured{background:#fbbf24}.tm-ai-dot.error{background:#ef4444}
.tm-ai-close{background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1}
.tm-ai-tabs{display:flex;border-bottom:1px solid #1e293b}
.tm-ai-tab{flex:1;background:transparent;border:none;color:#94a3b8;padding:10px 6px;font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid transparent;transition:all .15s;font-family:inherit}
.tm-ai-tab.active{color:#06b6d4;border-bottom-color:#06b6d4}
.tm-ai-body{padding:16px 18px;overflow-y:auto;flex:1;font-size:13px;line-height:1.6}
.tm-ai-body label{display:block;font-size:11px;color:#94a3b8;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:10px}
.tm-ai-body input, .tm-ai-body textarea{width:100%;background:#0a0e17;border:1px solid #1e293b;border-radius:6px;padding:8px 10px;color:#e2e8f0;font-size:13px;font-family:inherit;resize:vertical}
.tm-ai-body textarea{min-height:60px}
.tm-ai-go{background:linear-gradient(135deg,#a855f7,#06b6d4);color:#fff;border:none;padding:9px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-top:12px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.tm-ai-go:hover{filter:brightness(1.1)}
.tm-ai-go:disabled{opacity:.5;cursor:not-allowed}
.tm-ai-loading{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:tm-spin .6s linear infinite}
@keyframes tm-spin{to{transform:rotate(360deg)}}
.tm-ai-out{margin-top:14px;padding:12px;background:#0a0e17;border:1px dashed #1e293b;border-radius:8px;font-size:12px;white-space:pre-wrap;line-height:1.65;color:#e2e8f0}
.tm-ai-out strong{color:#06b6d4}
.tm-ai-out code{background:#1e293b;padding:1px 5px;border-radius:3px;font-size:11px;font-family:'Cascadia Code',monospace}
.tm-ai-empty{color:#64748b;font-style:italic;text-align:center;padding:18px}
.tm-ai-error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:10px;border-radius:6px;font-size:12px;margin-top:10px}
.tm-ai-threat-card{background:#1a2332;border:1px solid #1e293b;border-left:3px solid #06b6d4;border-radius:6px;padding:10px 12px;margin-bottom:8px;font-size:12px}
.tm-ai-threat-card.stride-S{border-left-color:#ef4444}
.tm-ai-threat-card.stride-T{border-left-color:#f97316}
.tm-ai-threat-card.stride-R{border-left-color:#fbbf24}
.tm-ai-threat-card.stride-I{border-left-color:#22c55e}
.tm-ai-threat-card.stride-D{border-left-color:#06b6d4}
.tm-ai-threat-card.stride-E{border-left-color:#a855f7}
.tm-ai-threat-card .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.tm-ai-threat-card .cat{font-size:10px;font-weight:700;padding:2px 7px;border-radius:9px;background:rgba(6,182,212,.15);color:#06b6d4;text-transform:uppercase;letter-spacing:1px}
.tm-ai-threat-card button{background:#06b6d4;color:#0a0e17;border:none;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
.tm-ai-threat-card button:disabled{opacity:.6;cursor:not-allowed}
.tm-ai-disclaimer{font-size:10px;color:#64748b;margin-top:10px;font-style:italic}
`;
const styleEl = document.createElement("style");
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ---------- Panel UI ----------
const fab = document.createElement("button");
fab.className = "tm-ai-fab";
fab.title = "AI threat-modeling assistant";
fab.innerHTML = "🤖";
document.body.appendChild(fab);

const panel = document.createElement("div");
panel.className = "tm-ai-panel";
panel.innerHTML = `
  <div class="tm-ai-head">
    <h3>🤖 AI threat modeler</h3>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="tm-ai-status"><span class="tm-ai-dot" id="tm-ai-dot"></span><span id="tm-ai-text">…</span></div>
      <button class="tm-ai-close" id="tm-ai-close">✕</button>
    </div>
  </div>
  <div class="tm-ai-tabs">
    <button class="tm-ai-tab active" data-tab="suggest">Suggest threats</button>
    <button class="tm-ai-tab" data-tab="dread">DREAD score</button>
    <button class="tm-ai-tab" data-tab="tree">Attack tree</button>
  </div>
  <div class="tm-ai-body">
    <div data-pane="suggest">
      <label>Adversary motive (optional)</label>
      <input id="tm-motive" placeholder="e.g., data theft, ransomware, supply-chain pivot">
      <label>Extra context (optional)</label>
      <textarea id="tm-context" placeholder="Anything specific about your environment, threat model assumptions, or constraints"></textarea>
      <button class="tm-ai-go" id="tm-suggest-btn">✨ Suggest threats</button>
      <div id="tm-suggest-out"></div>
    </div>
    <div data-pane="dread" style="display:none">
      <div class="tm-ai-out" style="font-size:12px"><strong>How it works:</strong> Reads threats from the workbench's current state and asks Gemini to estimate DREAD scores (Damage, Reproducibility, Exploitability, Affected users, Discoverability). Output is advisory — the workbench remains source of truth.</div>
      <button class="tm-ai-go" id="tm-dread-btn">✨ Score all threats</button>
      <div id="tm-dread-out"></div>
    </div>
    <div data-pane="tree" style="display:none">
      <label>Adversary goal (root of the tree)</label>
      <input id="tm-tree-goal" placeholder="e.g., Exfiltrate customer PII from production database">
      <label>Depth</label>
      <select id="tm-tree-depth" style="width:auto;padding:7px 10px;background:#0a0e17;border:1px solid #1e293b;color:#e2e8f0;border-radius:6px">
        <option value="2">2 levels</option>
        <option value="3" selected>3 levels</option>
        <option value="4">4 levels</option>
      </select>
      <button class="tm-ai-go" id="tm-tree-btn">✨ Draft attack tree</button>
      <div id="tm-tree-out"></div>
    </div>
  </div>
`;
document.body.appendChild(panel);

fab.addEventListener("click", () => panel.classList.toggle("open"));
document.getElementById("tm-ai-close").addEventListener("click", () => panel.classList.remove("open"));

// Tab switching
panel.querySelectorAll(".tm-ai-tab").forEach(t => {
  t.addEventListener("click", () => {
    panel.querySelectorAll(".tm-ai-tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    panel.querySelectorAll("[data-pane]").forEach(p => p.style.display = (p.dataset.pane === t.dataset.tab ? "" : "none"));
  });
});

// AI status
(function checkAIStatus() {
  const dot = document.getElementById("tm-ai-dot");
  const text = document.getElementById("tm-ai-text");
  try {
    const cfg = fbApp.options || {};
    if (!cfg.projectId || cfg.projectId.startsWith("REPLACE_")) {
      dot.className = "tm-ai-dot unconfigured"; text.textContent = "not configured";
    } else {
      dot.className = "tm-ai-dot ready"; text.textContent = "ready";
    }
  } catch (e) { dot.className = "tm-ai-dot error"; text.textContent = "error"; }
})();

// ---------- Helpers ----------
function getHostState() { return typeof state !== "undefined" ? state : null; }
function escapeHTML(s) { return String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function setLoading(btnId, txt) {
  const b = document.getElementById(btnId); if (!b) return () => {};
  b.dataset.orig = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="tm-ai-loading"></span> ${txt}`;
  return () => { b.disabled = false; b.innerHTML = b.dataset.orig; };
}
function renderError(id, msg) {
  document.getElementById(id).innerHTML = `<div class="tm-ai-error">⚠ ${escapeHTML(msg)}</div>`;
}

// ---------- Suggest threats ----------
document.getElementById("tm-suggest-btn").addEventListener("click", async () => {
  const s = getHostState();
  if (!s) return renderError("tm-suggest-out", "Couldn't read workbench state.");

  const stride = Array.from(s.selectedStride || []);
  if (!stride.length) return renderError("tm-suggest-out", "Select at least one STRIDE category in the workbench first.");

  const motive  = document.getElementById("tm-motive").value;
  const context = document.getElementById("tm-context").value;
  const stop = setLoading("tm-suggest-btn", "Thinking…");

  const prompt = `You are a senior threat modeler applying STRIDE to a system. Suggest specific, concrete threats — not generic categories.

System under analysis:
- Name: ${s.project?.name || "(unnamed)"}
- Description: ${s.project?.desc || "—"}
- Scope: ${s.project?.scope || "—"}
- Assets: ${(s.project?.assets||[]).map(a=>a.name||a).join(", ") || "—"}

STRIDE categories the analyst flagged as in-scope: ${stride.join(", ")}
Adversary motive: ${motive || "(not specified)"}
Extra context: ${context || "(none)"}

Existing threats already logged (avoid duplicates): ${(s.threats||[]).map(t=>t.title||t.name||"").join(" | ") || "(none)"}

Return JSON. Each threat should be specific to THIS system, not generic STRIDE examples.`;

  const schema = {
    type: "object",
    properties: {
      threats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stride: { type: "string", enum: ["S","T","R","I","D","E"] },
            title: { type: "string" },
            description: { type: "string" },
            attack_vector: { type: "string" },
            mitigation_suggestions: { type: "array", items: { type: "string" } }
          },
          required: ["stride","title","description","attack_vector","mitigation_suggestions"]
        }
      }
    },
    required: ["threats"]
  };

  const { data, error } = await askGeminiJSON(prompt, schema);
  stop();
  if (error) return renderError("tm-suggest-out", error);

  const cards = data.threats.map((t, idx) => `
    <div class="tm-ai-threat-card stride-${escapeHTML(t.stride)}" data-idx="${idx}">
      <div class="head">
        <span class="cat">${escapeHTML(t.stride)} · ${escapeHTML(t.title)}</span>
        <button data-add-idx="${idx}">+ Add to workbench</button>
      </div>
      <div><strong>What:</strong> ${escapeHTML(t.description)}</div>
      <div style="margin-top:4px"><strong>Vector:</strong> ${escapeHTML(t.attack_vector)}</div>
      <div style="margin-top:4px"><strong>Mitigations:</strong></div>
      <ul style="margin-left:18px;font-size:11px;color:#94a3b8">${t.mitigation_suggestions.map(m=>`<li>${escapeHTML(m)}</li>`).join("")}</ul>
    </div>`).join("");

  document.getElementById("tm-suggest-out").innerHTML = `<div style="margin-top:14px">${cards}</div><div class="tm-ai-disclaimer">⚠ AI suggestions — review before adding to the workbench.</div>`;

  // Hook up "Add" buttons
  document.querySelectorAll("[data-add-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = data.threats[+btn.dataset.addIdx];
      if (typeof window.quickAddThreat === "function") {
        // Some workbench versions accept (stride, title, description) — adapt as needed
        try { window.quickAddThreat(t.stride, t.title, t.description); }
        catch { try { window.quickAddThreat(t.stride, `${t.title}: ${t.description}`); } catch {} }
      } else if (typeof window.addThreat === "function") {
        try { window.addThreat({ stride: t.stride, title: t.title, description: t.description }); } catch {}
      }
      btn.textContent = "✓ Added"; btn.disabled = true;
    });
  });
});

// ---------- DREAD scoring ----------
document.getElementById("tm-dread-btn").addEventListener("click", async () => {
  const s = getHostState();
  if (!s) return renderError("tm-dread-out", "Couldn't read workbench state.");
  if (!s.threats?.length) return renderError("tm-dread-out", "No threats in the workbench yet. Add some first (manually or via the Suggest tab).");

  const stop = setLoading("tm-dread-btn", "Scoring…");
  const threatList = s.threats.map((t,i) => `${i+1}. [${t.stride||"?"}] ${t.title||t.name||"(untitled)"} — ${t.description||""}`).join("\n");

  const prompt = `Score each threat using the DREAD model (1-10 per dimension). Be conservative — don't inflate scores.

D = Damage potential
R = Reproducibility
E = Exploitability
A = Affected users
D2 = Discoverability

System context: ${s.project?.name || "—"} — ${s.project?.desc || "—"}

Threats:
${threatList}

Return JSON with one entry per threat in the same order.`;

  const schema = {
    type: "object",
    properties: {
      scores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            threat_index: { type: "integer" },
            damage: { type: "integer" },
            reproducibility: { type: "integer" },
            exploitability: { type: "integer" },
            affected_users: { type: "integer" },
            discoverability: { type: "integer" },
            rationale: { type: "string" }
          },
          required: ["threat_index","damage","reproducibility","exploitability","affected_users","discoverability","rationale"]
        }
      }
    },
    required: ["scores"]
  };

  const { data, error } = await askGeminiJSON(prompt, schema);
  stop();
  if (error) return renderError("tm-dread-out", error);

  const rows = data.scores.map(sc => {
    const total = sc.damage + sc.reproducibility + sc.exploitability + sc.affected_users + sc.discoverability;
    const sev = total >= 40 ? "critical" : total >= 30 ? "high" : total >= 20 ? "medium" : "low";
    const sevColor = { critical:"#ef4444", high:"#f97316", medium:"#fbbf24", low:"#22c55e" }[sev];
    const t = s.threats[sc.threat_index - 1] || { title:"(unknown)" };
    return `
      <div class="tm-ai-threat-card" style="border-left-color:${sevColor}">
        <div class="head">
          <span class="cat" style="background:${sevColor}22;color:${sevColor}">${total}/50 · ${sev}</span>
          <span style="font-size:11px;color:#94a3b8">D:${sc.damage} R:${sc.reproducibility} E:${sc.exploitability} A:${sc.affected_users} D:${sc.discoverability}</span>
        </div>
        <div><strong>${escapeHTML(t.title||t.name||"(untitled)")}</strong></div>
        <div style="color:#94a3b8;margin-top:4px;font-size:11px">${escapeHTML(sc.rationale)}</div>
      </div>`;
  }).join("");

  document.getElementById("tm-dread-out").innerHTML = `<div style="margin-top:14px">${rows}</div><div class="tm-ai-disclaimer">⚠ AI estimates. Sanity-check against your environment's reality before treating these as decision inputs.</div>`;
});

// ---------- Attack tree ----------
document.getElementById("tm-tree-btn").addEventListener("click", async () => {
  const goal = document.getElementById("tm-tree-goal").value.trim();
  if (!goal) return renderError("tm-tree-out", "Enter an adversary goal first.");
  const depth = +document.getElementById("tm-tree-depth").value;
  const stop = setLoading("tm-tree-btn", "Drafting…");
  const s = getHostState();

  const prompt = `You are drafting a Schneier-style attack tree. Each node is either:
- AND: all children must be achieved
- OR: any child achieves the parent

Root goal: """${goal}"""
System context: ${s?.project?.name || "—"} — ${s?.project?.desc || "—"}
Depth: ${depth} levels deep.

Return JSON with a recursive tree structure. Use "and"/"or" for the logic type. Keep node labels short (≤80 chars).`;

  const nodeSchema = {
    type: "object",
    properties: {
      label: { type: "string" },
      logic: { type: "string", enum: ["and","or","leaf"] },
      children: { type: "array", items: { type: "object" } }
    },
    required: ["label","logic","children"]
  };
  const schema = { type: "object", properties: { tree: nodeSchema }, required: ["tree"] };

  const { data, error } = await askGeminiJSON(prompt, schema);
  stop();
  if (error) return renderError("tm-tree-out", error);

  function renderNode(node, level = 0) {
    const indent = "  ".repeat(level);
    const prefix = level === 0 ? "🎯" : (node.logic === "and" ? "🔗 [AND]" : node.logic === "or" ? "🔀 [OR]" : "•");
    let out = `${indent}${prefix} ${node.label}\n`;
    if (node.children?.length) {
      node.children.forEach(c => { out += renderNode(c, level + 1); });
    }
    return out;
  }

  document.getElementById("tm-tree-out").innerHTML = `
    <div class="tm-ai-out"><pre style="font-family:'Cascadia Code',monospace;font-size:11px;line-height:1.5;margin:0;color:#e2e8f0;white-space:pre-wrap">${escapeHTML(renderNode(data.tree))}</pre></div>
    <button class="tm-ai-go" id="tm-tree-copy" style="background:#1e293b">📋 Copy as text</button>
    <button class="tm-ai-go" id="tm-tree-json" style="background:#1e293b;margin-left:6px">⬇ Download JSON</button>
    <div class="tm-ai-disclaimer">⚠ AI-drafted attack tree. Review for completeness — adversaries find paths you didn't think of.</div>`;

  document.getElementById("tm-tree-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(renderNode(data.tree)); alert("Copied."); } catch (e) {}
  });
  document.getElementById("tm-tree-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data.tree, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "attack-tree.json"; a.click();
    URL.revokeObjectURL(url);
  });
});
