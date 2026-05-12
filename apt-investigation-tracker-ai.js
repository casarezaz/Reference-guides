// AI retrofit for apt-investigation-tracker.html
// Drop-in module. Add to the existing tracker HTML with:
//   <script type="module" src="apt-investigation-tracker-ai.js"></script>
//
// What it adds (without modifying any existing code):
//   • AI status pill in the top-right of the nav
//   • IOC view: "AI: Triage IOCs" button → severity + suspected TTPs + pivots
//   • Attribution view: "AI: Draft narrative" → attribution write-up with competing hypotheses
//   • Report view: "AI: STIX narrative" → STIX 2.1-flavored bundle of evidence
//
// Reads existing localStorage key 'apt-tracker-db' — does not migrate or overwrite anything.

import { askGemini, askGeminiJSON, app as fbApp } from "./ai-config.js";

const STORAGE_KEY = "apt-tracker-db";

// ---------- Style injection ----------
const css = `
.ai-bar { display:inline-flex; align-items:center; gap:6px; margin-left:auto; font-size:11px; color:#94a3b8; padding:4px 10px; border:1px solid #1e293b; border-radius:14px; }
.ai-dot { width:8px; height:8px; border-radius:50%; background:#64748b; }
.ai-dot.ready { background:#22c55e; }
.ai-dot.unconfigured { background:#fbbf24; }
.ai-dot.error { background:#ef4444; }
.ai-btn { background:linear-gradient(135deg,#a855f7,#06b6d4); color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all .15s; }
.ai-btn:hover { transform:translateY(-1px); filter:brightness(1.1); }
.ai-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
.ai-btn-secondary { background:#1e293b; color:#e2e8f0; }
.ai-loading { display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:ai-spin .6s linear infinite; }
@keyframes ai-spin { to { transform:rotate(360deg); } }
.ai-panel { margin-top:14px; padding:16px; background:#0f172a; border:1px solid #1e293b; border-radius:10px; }
.ai-panel h4 { font-size:13px; color:#06b6d4; margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
.ai-panel .body { font-size:13px; color:#e2e8f0; line-height:1.65; white-space:pre-wrap; }
.ai-panel .body strong { color:#06b6d4; }
.ai-panel .body code { background:#1e293b; padding:1px 6px; border-radius:4px; font-size:12px; font-family:'Cascadia Code',monospace; }
.ai-error { background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.3); color:#fca5a5; padding:10px 12px; border-radius:8px; font-size:13px; margin-top:10px; }
.ai-empty { color:#64748b; font-style:italic; }
.ai-case-select { background:#0a0e17; color:#e2e8f0; border:1px solid #1e293b; padding:7px 10px; border-radius:6px; font-size:12px; min-width:200px; margin-right:8px; }
.ai-triage-row { display:flex; gap:10px; padding:10px 0; border-bottom:1px solid #1e293b; }
.ai-triage-row:last-child { border-bottom:none; }
.ai-triage-sev { font-size:10px; font-weight:700; padding:3px 8px; border-radius:10px; text-transform:uppercase; letter-spacing:1px; min-width:60px; text-align:center; height:fit-content; }
.ai-sev-critical { background:rgba(239,68,68,.2); color:#ef4444; border:1px solid #ef4444; }
.ai-sev-high { background:rgba(249,115,22,.2); color:#f97316; border:1px solid #f97316; }
.ai-sev-medium { background:rgba(251,191,36,.2); color:#fbbf24; border:1px solid #fbbf24; }
.ai-sev-low { background:rgba(34,197,94,.2); color:#22c55e; border:1px solid #22c55e; }
.ai-sev-info { background:rgba(6,182,212,.2); color:#06b6d4; border:1px solid #06b6d4; }
.ai-triage-body { flex:1; font-size:12px; }
.ai-triage-body .ioc { font-family:'Cascadia Code',monospace; color:#06b6d4; }
.ai-triage-body .reasoning { color:#94a3b8; margin-top:4px; }
.ai-triage-body .pivots { margin-top:4px; }
.ai-triage-body .pivot { display:inline-block; background:#1e293b; padding:2px 8px; border-radius:10px; font-size:10px; margin:2px 4px 2px 0; color:#a855f7; }
.ai-confidence { display:inline-block; padding:3px 10px; border-radius:10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
.ai-conf-high { background:rgba(34,197,94,.2); color:#22c55e; border:1px solid #22c55e; }
.ai-conf-medium { background:rgba(251,191,36,.2); color:#fbbf24; border:1px solid #fbbf24; }
.ai-conf-low { background:rgba(239,68,68,.2); color:#ef4444; border:1px solid #ef4444; }
.ai-disclaimer { font-size:10px; color:#64748b; margin-top:10px; font-style:italic; }
`;
const styleEl = document.createElement("style");
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ---------- Data accessors ----------
function loadDB() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"cases":[],"iocs":[],"ttps":[],"infra":[],"malware":[]}'); }
  catch { return { cases:[],iocs:[],ttps:[],infra:[],malware:[] }; }
}
function caseList()      { return loadDB().cases || []; }
function iocsForCase(id) { return (loadDB().iocs || []).filter(i => i.caseId === id); }
function ttpsForCase(id) { return (loadDB().ttps || []).filter(t => t.caseId === id); }
function infraForCase(id){ return (loadDB().infra || []).filter(i => i.caseId === id); }
function malForCase(id)  { return (loadDB().malware || []).filter(m => m.caseId === id); }
function caseById(id)    { return caseList().find(c => c.id === id); }

// ---------- AI status pill ----------
function installAIStatus() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const pill = document.createElement("div");
  pill.className = "ai-bar";
  pill.innerHTML = `<span class="ai-dot" id="ai-dot"></span><span id="ai-text">Checking AI…</span>`;
  nav.appendChild(pill);

  const dot  = document.getElementById("ai-dot");
  const text = document.getElementById("ai-text");
  try {
    const cfg = fbApp.options || {};
    if (!cfg.projectId || cfg.projectId.startsWith("REPLACE_")) {
      dot.className = "ai-dot unconfigured";
      text.textContent = "AI not configured";
    } else {
      dot.className = "ai-dot ready";
      text.textContent = `AI ready · ${cfg.projectId}`;
    }
  } catch (e) {
    dot.className = "ai-dot error";
    text.textContent = "AI init failed";
  }
}

// ---------- Helpers ----------
function escapeHTML(s) { return String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function renderMarkdownInline(s) {
  return escapeHTML(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^(\s*)[-*]\s+(.+)$/gm, "$1• $2");
}
function buildCaseSelect(id, withAllOption) {
  const cases = caseList();
  const opts = (withAllOption ? `<option value="">— select a case —</option>` : "")
    + cases.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.actor||"unknown")})</option>`).join("");
  return `<select id="${id}" class="ai-case-select">${opts || `<option value="">No cases yet — create one first</option>`}</select>`;
}
function setLoading(btn, txt) {
  if (!btn) return () => {};
  btn.dataset.orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="ai-loading"></span> ${txt}`;
  return () => { btn.disabled = false; btn.innerHTML = btn.dataset.orig; };
}

// ---------- Section: IOC triage ----------
function summarizeIOCs(iocs) {
  return iocs.map(i =>
    `- [${i.type}] ${i.value} · source: ${i.source||"—"} · conf: ${i.confidence||"—"} · firstSeen: ${i.firstSeen||"—"} · tags: ${(i.tags||[]).join(",")||"—"} · notes: ${i.notes||"—"}`
  ).join("\n");
}

function installIOCTriage() {
  const view = document.getElementById("v-iocs");
  if (!view) return;
  const wrap = document.createElement("div");
  wrap.style.marginTop = "16px";
  wrap.innerHTML = `
    <button class="ai-btn" id="ai-triage-btn">🤖 AI: Triage IOCs</button>
    ${buildCaseSelect("ai-triage-case", true)}
    <div id="ai-triage-out"></div>`;
  view.appendChild(wrap);

  document.getElementById("ai-triage-btn").addEventListener("click", async () => {
    const sel = document.getElementById("ai-triage-case");
    const caseId = sel.value;
    if (!caseId) { renderError("ai-triage-out", "Select a case first."); return; }
    const iocs = iocsForCase(caseId);
    if (!iocs.length) { renderError("ai-triage-out", "This case has no IOCs to triage."); return; }
    const c = caseById(caseId);

    const stop = setLoading(document.getElementById("ai-triage-btn"), "Triaging…");
    const prompt = `You are a senior CTI analyst triaging IOCs from an active investigation.

Case: ${c?.name || "—"} (suspected actor: ${c?.actor || "unknown"}, sector: ${c?.sector || "—"})
Case description: ${c?.desc || "—"}

IOCs to triage (${iocs.length}):
${summarizeIOCs(iocs)}

For each IOC return JSON. Be specific. Severity scale: critical / high / medium / low / info.
Pivots are concrete next-steps (e.g., "search EDR for parent process spawning powershell.exe with -EncodedCommand").`;

    const schema = {
      type: "object",
      properties: {
        triage: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ioc_value: { type: "string" },
              severity: { type: "string", enum: ["critical","high","medium","low","info"] },
              reasoning: { type: "string" },
              suspected_ttps: { type: "array", items: { type: "string" } },
              false_positive_likelihood: { type: "string", enum: ["high","medium","low"] },
              pivots: { type: "array", items: { type: "string" } }
            },
            required: ["ioc_value","severity","reasoning","suspected_ttps","false_positive_likelihood","pivots"]
          }
        },
        overall_assessment: { type: "string" }
      },
      required: ["triage","overall_assessment"]
    };

    const { data, error } = await askGeminiJSON(prompt, schema);
    stop();
    if (error) return renderError("ai-triage-out", error);

    const rows = data.triage.map(t => `
      <div class="ai-triage-row">
        <div class="ai-triage-sev ai-sev-${escapeHTML(t.severity)}">${escapeHTML(t.severity)}</div>
        <div class="ai-triage-body">
          <div class="ioc">${escapeHTML(t.ioc_value)}</div>
          <div class="reasoning">${escapeHTML(t.reasoning)}</div>
          <div class="reasoning">FP likelihood: <strong>${escapeHTML(t.false_positive_likelihood)}</strong></div>
          <div class="pivots">${(t.suspected_ttps||[]).map(s=>`<span class="pivot">${escapeHTML(s)}</span>`).join("")}</div>
          <div class="reasoning"><strong>Pivots:</strong></div>
          <ul style="margin-left:18px;color:#94a3b8;font-size:12px">${(t.pivots||[]).map(p=>`<li>${escapeHTML(p)}</li>`).join("")}</ul>
        </div>
      </div>`).join("");

    document.getElementById("ai-triage-out").innerHTML = `
      <div class="ai-panel">
        <h4>AI triage · ${data.triage.length} IOC${data.triage.length===1?"":"s"}</h4>
        <div class="body"><strong>Overall:</strong> ${escapeHTML(data.overall_assessment)}</div>
        <div style="margin-top:14px">${rows}</div>
        <div class="ai-disclaimer">⚠ AI assessment — verify each IOC against your own threat intel before acting.</div>
      </div>`;
  });
}

// ---------- Section: Attribution narrative ----------
function installAttribution() {
  const view = document.getElementById("v-attribution");
  if (!view) return;
  const wrap = document.createElement("div");
  wrap.style.marginTop = "16px";
  wrap.innerHTML = `
    <button class="ai-btn" id="ai-attrib-btn">🤖 AI: Draft attribution narrative</button>
    ${buildCaseSelect("ai-attrib-case", true)}
    <div id="ai-attrib-out"></div>`;
  view.appendChild(wrap);

  document.getElementById("ai-attrib-btn").addEventListener("click", async () => {
    const sel = document.getElementById("ai-attrib-case");
    const caseId = sel.value;
    if (!caseId) { renderError("ai-attrib-out", "Select a case first."); return; }
    const c = caseById(caseId);
    if (!c) { renderError("ai-attrib-out", "Case not found."); return; }

    const stop = setLoading(document.getElementById("ai-attrib-btn"), "Drafting…");

    const iocs = iocsForCase(caseId);
    const ttps = ttpsForCase(caseId);
    const infra = infraForCase(caseId);
    const mal = malForCase(caseId);

    const evidence = `
**Case:** ${c.name}
**Suspected actor:** ${c.actor || "unknown"}
**Sector targeted:** ${c.sector || "—"}
**Status / priority:** ${c.status} / ${c.priority}
**Description:** ${c.desc || "—"}

**Diamond Model:**
- Adversary: ${c.diamond?.adversary?.desc || "—"} (items: ${(c.diamond?.adversary?.items||[]).length})
- Capability: ${c.diamond?.capability?.desc || "—"} (items: ${(c.diamond?.capability?.items||[]).length})
- Infrastructure: ${c.diamond?.infrastructure?.desc || "—"} (items: ${(c.diamond?.infrastructure?.items||[]).length})
- Victim: ${c.diamond?.victim?.desc || "—"} (items: ${(c.diamond?.victim?.items||[]).length})

**IOCs (${iocs.length}):**
${summarizeIOCs(iocs) || "—"}

**TTPs (${ttps.length}):**
${ttps.map(t=>`- ${t.tactic||""} / ${t.technique||""} / ${t.id||""} — ${t.notes||""}`).join("\n") || "—"}

**Infrastructure (${infra.length}):**
${infra.map(i=>`- ${i.type||""}: ${i.value||""} — ${i.notes||""}`).join("\n") || "—"}

**Malware (${mal.length}):**
${mal.map(m=>`- ${m.family||""}: ${m.name||""} — ${m.notes||""}`).join("\n") || "—"}`;

    const prompt = `You are a CTI lead drafting an attribution assessment for an investigation. Apply analytic tradecraft (ICD-203 confidence language, competing hypotheses, evidence linkage).

Evidence:
${evidence}

Return JSON.`;

    const schema = {
      type: "object",
      properties: {
        primary_hypothesis: {
          type: "object",
          properties: {
            actor: { type: "string" },
            confidence: { type: "string", enum: ["high","medium","low"] },
            confidence_rationale: { type: "string" },
            supporting_evidence: { type: "array", items: { type: "string" } }
          },
          required: ["actor","confidence","confidence_rationale","supporting_evidence"]
        },
        competing_hypotheses: {
          type: "array",
          items: {
            type: "object",
            properties: { actor: { type: "string" }, why_not: { type: "string" } },
            required: ["actor","why_not"]
          }
        },
        evidence_gaps: { type: "array", items: { type: "string" } },
        narrative_markdown: { type: "string" }
      },
      required: ["primary_hypothesis","competing_hypotheses","evidence_gaps","narrative_markdown"]
    };

    const { data, error } = await askGeminiJSON(prompt, schema);
    stop();
    if (error) return renderError("ai-attrib-out", error);

    const ph = data.primary_hypothesis;
    document.getElementById("ai-attrib-out").innerHTML = `
      <div class="ai-panel">
        <h4>Primary hypothesis</h4>
        <div class="body">
          <strong>${escapeHTML(ph.actor)}</strong>
          <span class="ai-confidence ai-conf-${escapeHTML(ph.confidence)}" style="margin-left:10px">${escapeHTML(ph.confidence)} confidence</span>
          <div style="margin-top:8px">${escapeHTML(ph.confidence_rationale)}</div>
          <div style="margin-top:10px"><strong>Supporting evidence:</strong></div>
          <ul style="margin-left:20px;margin-top:6px">${ph.supporting_evidence.map(e=>`<li>${escapeHTML(e)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="ai-panel">
        <h4>Competing hypotheses</h4>
        <div class="body">${data.competing_hypotheses.length === 0 ? `<span class="ai-empty">No serious alternatives identified.</span>` : data.competing_hypotheses.map(h => `<div style="margin-bottom:10px"><strong>${escapeHTML(h.actor)}</strong><br><span style="color:#94a3b8">${escapeHTML(h.why_not)}</span></div>`).join("")}</div>
      </div>
      <div class="ai-panel">
        <h4>Evidence gaps</h4>
        <div class="body"><ul style="margin-left:20px">${data.evidence_gaps.map(g=>`<li>${escapeHTML(g)}</li>`).join("") || "<li>None identified.</li>"}</ul></div>
      </div>
      <div class="ai-panel">
        <h4>Full narrative</h4>
        <div class="body">${renderMarkdownInline(data.narrative_markdown)}</div>
        <div style="margin-top:12px">
          <button class="ai-btn ai-btn-secondary" id="ai-attrib-copy">📋 Copy narrative</button>
          <button class="ai-btn ai-btn-secondary" id="ai-attrib-download">⬇ Download .md</button>
        </div>
        <div class="ai-disclaimer">⚠ AI-generated attribution. Treat as a starting point for analyst review — never as a final attribution call.</div>
      </div>`;

    document.getElementById("ai-attrib-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(data.narrative_markdown); alert("Copied."); } catch (e) { alert("Copy failed."); }
    });
    document.getElementById("ai-attrib-download").addEventListener("click", () => {
      const blob = new Blob([data.narrative_markdown], { type:"text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `attribution-${c.name.replace(/\W+/g,"-")}.md`; a.click();
      URL.revokeObjectURL(url);
    });
  });
}

// ---------- Section: STIX narrative ----------
function installSTIX() {
  const view = document.getElementById("v-report");
  if (!view) return;
  const wrap = document.createElement("div");
  wrap.style.marginTop = "16px";
  wrap.innerHTML = `
    <button class="ai-btn" id="ai-stix-btn">🤖 AI: STIX narrative</button>
    ${buildCaseSelect("ai-stix-case", true)}
    <div id="ai-stix-out"></div>`;
  view.appendChild(wrap);

  document.getElementById("ai-stix-btn").addEventListener("click", async () => {
    const sel = document.getElementById("ai-stix-case");
    const caseId = sel.value;
    if (!caseId) { renderError("ai-stix-out", "Select a case first."); return; }
    const c = caseById(caseId);

    const stop = setLoading(document.getElementById("ai-stix-btn"), "Generating…");

    const iocs = iocsForCase(caseId);
    const ttps = ttpsForCase(caseId);

    const prompt = `You are a CTI engineer writing a STIX 2.1-flavored narrative bundle summary for an investigation. Output is a human-readable narrative organized by STIX object types — NOT raw JSON STIX (that's a separate tool). Audience: peer CTI analysts.

Case: ${c?.name || "—"} (actor: ${c?.actor || "unknown"})
IOCs (${iocs.length}):
${summarizeIOCs(iocs) || "—"}
TTPs (${ttps.length}):
${ttps.map(t=>`- ${t.tactic||""} / ${t.technique||""} / ${t.id||""}`).join("\n") || "—"}

Produce markdown with these sections:
**Identity** — the targeted org / sector.
**Threat Actor** — what we know about who.
**Campaign** — timeframe, scope, goals as observed.
**Attack Pattern (ATT&CK)** — TTPs in play.
**Indicators** — IOCs grouped by type.
**Infrastructure** — hosting, C2, redirectors.
**Malware** — families observed.
**Observed Relationships** — how the above link together (e.g., "Threat Actor uses Malware, Malware communicates with Infrastructure").
**Recommendations** — defensive actions, hunt priorities.

Keep it tight — analysts read these fast. Use markdown tables where it adds clarity. Cite "(no data)" for empty sections rather than inventing content.`;

    const { text, error } = await askGemini(prompt);
    stop();
    if (error) return renderError("ai-stix-out", error);

    document.getElementById("ai-stix-out").innerHTML = `
      <div class="ai-panel">
        <h4>STIX 2.1-style narrative</h4>
        <div class="body">${renderMarkdownInline(text)}</div>
        <div style="margin-top:12px">
          <button class="ai-btn ai-btn-secondary" id="ai-stix-copy">📋 Copy</button>
          <button class="ai-btn ai-btn-secondary" id="ai-stix-download">⬇ Download .md</button>
        </div>
        <div class="ai-disclaimer">⚠ AI-generated. Use as a draft — review every claim against your source evidence before circulating.</div>
      </div>`;

    document.getElementById("ai-stix-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); alert("Copied."); } catch (e) { alert("Copy failed."); }
    });
    document.getElementById("ai-stix-download").addEventListener("click", () => {
      const blob = new Blob([text], { type:"text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `stix-narrative-${(c?.name||"case").replace(/\W+/g,"-")}.md`; a.click();
      URL.revokeObjectURL(url);
    });
  });
}

function renderError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="ai-error">⚠ ${escapeHTML(msg)}</div>`;
}

// ---------- Init ----------
function init() {
  installAIStatus();
  installIOCTriage();
  installAttribution();
  installSTIX();

  // Refresh case dropdowns when cases change. The host app exposes
  // populateCaseDropdowns globally; we wrap it to also refresh our selects.
  if (typeof window.populateCaseDropdowns === "function") {
    const orig = window.populateCaseDropdowns;
    window.populateCaseDropdowns = function() {
      orig.apply(this, arguments);
      refreshOurSelects();
    };
  }
}
function refreshOurSelects() {
  ["ai-triage-case","ai-attrib-case","ai-stix-case"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    const cases = caseList();
    sel.innerHTML = `<option value="">— select a case —</option>` +
      cases.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.actor||"unknown")})</option>`).join("");
    if (current) sel.value = current;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
