// AI retrofit for interview-prep-engine.html
// Drop-in module — adaptive scenario generation + AI grader.
//
// Add with: <script type="module" src="interview-prep-engine-ai.js"></script>

import { askGemini, askGeminiJSON, app as fbApp } from "./ai-config.js";

const css = `
.ip-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#06b6d4);border:none;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 22px rgba(34,197,94,.4);z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s}
.ip-fab:hover{transform:scale(1.08)}
.ip-panel{position:fixed;bottom:90px;right:24px;width:480px;max-width:calc(100vw - 48px);max-height:calc(100vh - 130px);background:#0f172a;border:1px solid #1e293b;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:9997;display:none;flex-direction:column;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
.ip-panel.open{display:flex}
.ip-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #1e293b}
.ip-head h3{font-size:14px;font-weight:600}
.ip-status{font-size:10px;display:flex;align-items:center;gap:5px;color:#94a3b8;background:#1a2332;padding:3px 9px;border-radius:10px}
.ip-dot{width:7px;height:7px;border-radius:50%;background:#64748b}
.ip-dot.ready{background:#22c55e}.ip-dot.unconfigured{background:#fbbf24}.ip-dot.error{background:#ef4444}
.ip-close{background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1}
.ip-tabs{display:flex;border-bottom:1px solid #1e293b}
.ip-tab{flex:1;background:transparent;border:none;color:#94a3b8;padding:10px 6px;font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid transparent;font-family:inherit}
.ip-tab.active{color:#22c55e;border-bottom-color:#22c55e}
.ip-body{padding:14px 18px;overflow-y:auto;flex:1;font-size:13px}
.ip-body label{display:block;font-size:11px;color:#94a3b8;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:10px}
.ip-body select, .ip-body input, .ip-body textarea{width:100%;background:#0a0e17;border:1px solid #1e293b;border-radius:6px;padding:8px 10px;color:#e2e8f0;font-size:13px;font-family:inherit;resize:vertical}
.ip-body textarea{min-height:80px}
.ip-go{background:linear-gradient(135deg,#22c55e,#06b6d4);color:#0a0e17;border:none;padding:9px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-top:12px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.ip-go:hover{filter:brightness(1.1)}
.ip-go:disabled{opacity:.5;cursor:not-allowed}
.ip-loading{display:inline-block;width:12px;height:12px;border:2px solid rgba(0,0,0,.3);border-top-color:#0a0e17;border-radius:50%;animation:ip-spin .6s linear infinite}
@keyframes ip-spin{to{transform:rotate(360deg)}}
.ip-error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:10px;border-radius:6px;font-size:12px;margin-top:10px}
.ip-scenario{margin-top:14px;padding:14px;background:#1a2332;border:1px solid #1e293b;border-radius:8px;font-size:13px;line-height:1.6}
.ip-scenario h4{font-size:13px;color:#06b6d4;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
.ip-scenario .diff{display:inline-block;font-size:10px;padding:2px 8px;border-radius:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-left:6px}
.ip-diff-easy{background:rgba(34,197,94,.15);color:#22c55e}
.ip-diff-medium{background:rgba(251,191,36,.15);color:#fbbf24}
.ip-diff-hard{background:rgba(239,68,68,.15);color:#ef4444}
.ip-rubric{margin-top:10px;font-size:12px;color:#94a3b8}
.ip-rubric ul{margin-left:18px;margin-top:4px}
.ip-grade-summary{margin-top:14px;padding:14px;background:#0a0e17;border-left:3px solid #22c55e;border-radius:6px}
.ip-grade-score{font-size:32px;font-weight:700;color:#22c55e}
.ip-grade-score.medium{color:#fbbf24}
.ip-grade-score.low{color:#ef4444}
.ip-feedback-section{margin-top:10px;font-size:12px;line-height:1.6}
.ip-feedback-section strong{color:#06b6d4;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;font-size:11px}
.ip-disclaimer{font-size:10px;color:#64748b;margin-top:10px;font-style:italic}
`;
const styleEl = document.createElement("style"); styleEl.textContent = css; document.head.appendChild(styleEl);

const fab = document.createElement("button");
fab.className = "ip-fab"; fab.innerHTML = "🎓"; fab.title = "AI interview coach";
document.body.appendChild(fab);

const panel = document.createElement("div");
panel.className = "ip-panel";
panel.innerHTML = `
  <div class="ip-head">
    <h3>🎓 AI interview coach</h3>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="ip-status"><span class="ip-dot" id="ip-dot"></span><span id="ip-text">…</span></div>
      <button class="ip-close" id="ip-close">✕</button>
    </div>
  </div>
  <div class="ip-tabs">
    <button class="ip-tab active" data-tab="gen">Generate scenario</button>
    <button class="ip-tab" data-tab="grade">Grade my answer</button>
  </div>
  <div class="ip-body">
    <div data-pane="gen">
      <label>Category</label>
      <select id="ip-cat">
        <option value="threat-modeling">Threat modeling</option>
        <option value="attack-analysis">Attack analysis</option>
        <option value="cloud-security">Cloud security</option>
        <option value="os-internals">OS internals</option>
        <option value="ai-security">AI security</option>
        <option value="behavioral">Behavioral</option>
      </select>
      <label>Difficulty</label>
      <select id="ip-diff">
        <option value="auto">Auto-adapt to my history</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <label>Focus (optional)</label>
      <input id="ip-focus" placeholder="e.g., supply chain attacks, Azure AD, kernel exploitation">
      <button class="ip-go" id="ip-gen-btn">✨ Generate scenario</button>
      <div id="ip-scenario-out"></div>
    </div>
    <div data-pane="grade" style="display:none">
      <label>Scenario / question you answered</label>
      <textarea id="ip-grade-q" placeholder="Paste the question here (or load from generated scenario above)"></textarea>
      <label>Your answer</label>
      <textarea id="ip-grade-a" placeholder="Paste your full answer here for AI grading"></textarea>
      <label>Rubric (optional — leave blank to use a generic one)</label>
      <textarea id="ip-grade-rubric" placeholder="One bullet per criterion, e.g.&#10;- Identifies the right threat model&#10;- Maps to STRIDE&#10;- Discusses mitigations" style="min-height:60px;font-size:12px"></textarea>
      <button class="ip-go" id="ip-grade-btn">✨ Grade my answer</button>
      <div id="ip-grade-out"></div>
    </div>
  </div>
`;
document.body.appendChild(panel);

fab.addEventListener("click", () => panel.classList.toggle("open"));
document.getElementById("ip-close").addEventListener("click", () => panel.classList.remove("open"));
panel.querySelectorAll(".ip-tab").forEach(t => {
  t.addEventListener("click", () => {
    panel.querySelectorAll(".ip-tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    panel.querySelectorAll("[data-pane]").forEach(p => p.style.display = (p.dataset.pane === t.dataset.tab ? "" : "none"));
  });
});

(function checkAIStatus() {
  const dot = document.getElementById("ip-dot");
  const text = document.getElementById("ip-text");
  try {
    const cfg = fbApp.options || {};
    if (!cfg.projectId || cfg.projectId.startsWith("REPLACE_")) {
      dot.className = "ip-dot unconfigured"; text.textContent = "not configured";
    } else {
      dot.className = "ip-dot ready"; text.textContent = "ready";
    }
  } catch (e) { dot.className = "ip-dot error"; text.textContent = "error"; }
})();

function escapeHTML(s) { return String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function getHostState() { return typeof state !== "undefined" ? state : null; }

// ---------- Generate scenario ----------
document.getElementById("ip-gen-btn").addEventListener("click", async () => {
  const cat = document.getElementById("ip-cat").value;
  let diff = document.getElementById("ip-diff").value;
  const focus = document.getElementById("ip-focus").value.trim();
  const s = getHostState();

  // Auto-adapt: look at host's history
  if (diff === "auto") {
    if (s?.history?.length) {
      const recent = s.history.slice(-5);
      const avg = recent.reduce((a, h) => a + (h.score || 0), 0) / recent.length;
      diff = avg >= 80 ? "hard" : avg >= 50 ? "medium" : "easy";
    } else {
      diff = "medium";
    }
  }

  const btn = document.getElementById("ip-gen-btn");
  btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="ip-loading"></span> Generating…`;

  const recentTopics = (s?.history || []).slice(-10).map(h => h.scenarioTitle || h.category || "").filter(Boolean);

  const prompt = `Generate a security R&D interview scenario for self-practice.

Category: ${cat}
Difficulty: ${diff}
Focus: ${focus || "(any)"}
Recent topics the user has practiced (vary from these): ${recentTopics.join(", ") || "(none)"}

Produce a realistic scenario a senior security research interviewer might give. It should:
- Be specific (named technologies, concrete environment details)
- Have a clear evaluation rubric (3-5 criteria)
- Include 1-2 follow-up probes the interviewer might ask
- Include a hint for if the candidate gets stuck

Return JSON.`;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      scenario: { type: "string" },
      difficulty: { type: "string", enum: ["easy","medium","hard"] },
      rubric: { type: "array", items: { type: "string" } },
      follow_ups: { type: "array", items: { type: "string" } },
      hint: { type: "string" },
      gold_answer_outline: { type: "string" }
    },
    required: ["title","scenario","rubric","follow_ups","hint","gold_answer_outline"]
  };

  const { data, error } = await askGeminiJSON(prompt, schema);
  btn.disabled = false; btn.innerHTML = btn.dataset.orig;
  if (error) { document.getElementById("ip-scenario-out").innerHTML = `<div class="ip-error">⚠ ${escapeHTML(error)}</div>`; return; }

  document.getElementById("ip-scenario-out").innerHTML = `
    <div class="ip-scenario">
      <h4>${escapeHTML(data.title)} <span class="diff ip-diff-${escapeHTML(data.difficulty||diff)}">${escapeHTML(data.difficulty||diff)}</span></h4>
      <div>${escapeHTML(data.scenario)}</div>
      <div class="ip-rubric">
        <strong style="color:#06b6d4">Rubric:</strong>
        <ul>${data.rubric.map(r => `<li>${escapeHTML(r)}</li>`).join("")}</ul>
      </div>
      <div class="ip-rubric">
        <strong style="color:#06b6d4">Follow-up probes:</strong>
        <ul>${data.follow_ups.map(f => `<li>${escapeHTML(f)}</li>`).join("")}</ul>
      </div>
      <details style="margin-top:10px">
        <summary style="cursor:pointer;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Show hint</summary>
        <div style="margin-top:6px;font-size:12px;color:#94a3b8">${escapeHTML(data.hint)}</div>
      </details>
      <details style="margin-top:6px">
        <summary style="cursor:pointer;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Show gold-answer outline (don't peek!)</summary>
        <div style="margin-top:6px;font-size:12px;color:#94a3b8;white-space:pre-wrap">${escapeHTML(data.gold_answer_outline)}</div>
      </details>
      <button class="ip-go" id="ip-load-grade" style="margin-top:12px">→ Load into grader</button>
    </div>
    <div class="ip-disclaimer">⚠ AI-generated scenario. Treat it as practice, not as a leaked interview question.</div>`;

  document.getElementById("ip-load-grade").addEventListener("click", () => {
    document.getElementById("ip-grade-q").value = `${data.title}\n\n${data.scenario}\n\nFollow-up probes:\n${data.follow_ups.map(f => "- " + f).join("\n")}`;
    document.getElementById("ip-grade-rubric").value = data.rubric.map(r => "- " + r).join("\n");
    // Switch to grade tab
    panel.querySelectorAll(".ip-tab").forEach(x => x.classList.remove("active"));
    panel.querySelector('[data-tab="grade"]').classList.add("active");
    panel.querySelectorAll("[data-pane]").forEach(p => p.style.display = (p.dataset.pane === "grade" ? "" : "none"));
  });
});

// ---------- Grade answer ----------
document.getElementById("ip-grade-btn").addEventListener("click", async () => {
  const q = document.getElementById("ip-grade-q").value.trim();
  const a = document.getElementById("ip-grade-a").value.trim();
  const rubric = document.getElementById("ip-grade-rubric").value.trim();
  const out = document.getElementById("ip-grade-out");

  if (!q || !a) { out.innerHTML = `<div class="ip-error">Both question and your answer are required.</div>`; return; }

  const btn = document.getElementById("ip-grade-btn");
  btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="ip-loading"></span> Grading…`;

  const prompt = `You are a strict but fair interview coach for security research candidates. Grade the candidate's answer rigorously.

SCENARIO:
${q}

RUBRIC:
${rubric || "(none provided — use sensible criteria for a security R&D interview answer: technical accuracy, structured thinking, mention of trade-offs, awareness of detection/mitigation, clarity)"}

CANDIDATE'S ANSWER:
${a}

Return JSON. Score 0-100. Be specific in feedback — quote the candidate's actual words where useful.`;

  const schema = {
    type: "object",
    properties: {
      score: { type: "integer" },
      tldr: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      follow_up_question: { type: "string" }
    },
    required: ["score","tldr","strengths","gaps","improvements","follow_up_question"]
  };

  const { data, error } = await askGeminiJSON(prompt, schema);
  btn.disabled = false; btn.innerHTML = btn.dataset.orig;
  if (error) { out.innerHTML = `<div class="ip-error">⚠ ${escapeHTML(error)}</div>`; return; }

  const scoreCls = data.score >= 75 ? "" : data.score >= 50 ? "medium" : "low";
  out.innerHTML = `
    <div class="ip-grade-summary">
      <div class="ip-grade-score ${scoreCls}">${data.score}/100</div>
      <div style="font-size:13px;color:#e2e8f0;margin-top:6px">${escapeHTML(data.tldr)}</div>
      <div class="ip-feedback-section">
        <strong>What worked</strong>
        <ul style="margin-left:18px;color:#94a3b8">${data.strengths.map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
      </div>
      <div class="ip-feedback-section">
        <strong>Gaps</strong>
        <ul style="margin-left:18px;color:#94a3b8">${data.gaps.map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
      </div>
      <div class="ip-feedback-section">
        <strong>How to improve next time</strong>
        <ul style="margin-left:18px;color:#94a3b8">${data.improvements.map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
      </div>
      <div class="ip-feedback-section">
        <strong>Interviewer follow-up</strong>
        <div style="color:#94a3b8;font-style:italic;margin-top:4px">"${escapeHTML(data.follow_up_question)}"</div>
      </div>
    </div>
    <div class="ip-disclaimer">⚠ AI grading. Use it as a sparring partner — a real interviewer's judgment is what counts.</div>`;
});
