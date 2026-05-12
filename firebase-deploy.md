# Firebase Deploy Guide — Reference-guides

This guide turns the static demo into a Firebase-hosted site with the AI Field Lab apps wired to **Firebase AI Logic (Gemini)**.

## What's in this folder

| File | What it is |
|---|---|
| `firebase.json` | Firebase Hosting config — serves the repo as-is, no rebuild step. |
| `.firebaserc` | Project ID binding. **You must edit this** before deploy. |
| `ai-config.js` | Shared Firebase + Gemini init for every AI app. Edit the placeholders once. |
| `ai-threat-hunt-builder.html` | Field Lab app #1 — PEAK-style hunt planning. |
| `ai-asset-blast-radius-mapper.html` | Field Lab app #2 — AI inventory + blast-radius scoring. |
| `ai-agent-evidence-lab.html` | Field Lab app #3 — agent-trace reconstruction + IR write-up. |
| `apt-investigation-tracker-ai.js` | Retrofit module — adds AI IOC triage + attribution + STIX narrative to the existing tracker. |
| `threat-modeling-workbench-ai.js` | Retrofit module — adds floating AI panel with threat suggestions, DREAD scoring, attack tree drafting. |
| `mitre-attack-explorer-ai.js` | Retrofit module — adds natural-language → technique lookup with jump-to-detail. |
| `firebase-deploy.md` | This guide. |

All three AI Field Lab apps and three retrofits are now built. Two more retrofits (AI Security Research Toolkit, Interview Prep Engine) are pending if you want them.

## Steps

### 1. Drop these files into your repo

Copy the files in this folder into the root of your local clone of `casarezaz/Reference-guides`. The three AI Field Lab apps belong in `ai-field-lab/`.

```
Reference-guides/
├── firebase.json                          ← NEW
├── .firebaserc                            ← NEW (edit project ID)
├── ai-config.js                           ← NEW (edit Firebase config)
├── index.html
├── apt-investigation-tracker.html         (existing — add one <script> line)
├── apt-investigation-tracker-ai.js        ← NEW (drop-in retrofit module)
├── threat-modeling-workbench.html         (existing — add one <script> line)
├── threat-modeling-workbench-ai.js        ← NEW (drop-in retrofit module)
├── mitre-attack-explorer.html             (existing — add one <script> line)
├── mitre-attack-explorer-ai.js            ← NEW (drop-in retrofit module)
├── …(other existing tools, unmodified)…
└── ai-field-lab/
    ├── index.html                          (already exists)
    ├── ai-threat-hunt-builder.html        ← NEW
    ├── ai-asset-blast-radius-mapper.html  ← NEW
    └── ai-agent-evidence-lab.html         ← NEW
```

### Wiring up the retrofit modules

For each of the three existing tools getting an AI retrofit, add **one line** to the existing HTML, just before the closing `</body>` tag — don't modify any other code:

```html
<!-- apt-investigation-tracker.html -->
<script type="module" src="apt-investigation-tracker-ai.js"></script>

<!-- threat-modeling-workbench.html -->
<script type="module" src="threat-modeling-workbench-ai.js"></script>

<!-- mitre-attack-explorer.html -->
<script type="module" src="mitre-attack-explorer-ai.js"></script>
```

Each retrofit reads the host page's existing state (localStorage for the tracker, the `state` global for the workbench and explorer) and either augments the existing UI (tracker) or floats a panel anchored to the viewport (workbench, explorer). No changes to existing files beyond the one script tag.

### 2. Install the Firebase CLI (one-time)

```bash
npm install -g firebase-tools
firebase login
```

### 3. Point `.firebaserc` at your project

Open `.firebaserc` and replace `REPLACE_WITH_YOUR_PROJECT_ID` with your actual Firebase project ID. You can confirm by running `firebase projects:list`.

### 4. Enable services in the Firebase Console

In `console.firebase.google.com/project/<your-project>/`:

- **Hosting** → click "Get started" if you haven't already.
- **Build → AI Logic** → click "Get started" → choose the **Gemini Developer API** backend (no Google Cloud billing required to start; you can upgrade to Vertex AI later) → enable.
- **Build → App Check** (recommended): register the web app, attach a reCAPTCHA Enterprise provider. Without this, anyone who views source can call your Gemini quota.
- **Project Settings → General → Your apps** → Web app → copy the `firebaseConfig` block.

### 5. Edit `ai-config.js`

Paste the `firebaseConfig` values into the placeholders. If you set up App Check in step 4, set `APP_CHECK_ENABLED = true` and paste the reCAPTCHA Enterprise site key.

### 6. Deploy

From the repo root:

```bash
firebase deploy --only hosting
```

You'll get back a `https://<project-id>.web.app` URL. Open `https://<project-id>.web.app/ai-field-lab/ai-threat-hunt-builder.html` — the AI status dot in the top-right should be green if `ai-config.js` is configured.

### 7. Verify

- Landing page loads at the root URL (same look as GitHub Pages).
- Each existing tool loads at its same `*.html` path.
- The AI Threat Hunt Builder, AI Asset & Blast Radius Mapper, and AI Agent Evidence Lab all load. AI buttons return text from Gemini (green status dot in topbar).

## What's next (after this is live)

1. Remaining AI retrofits (optional — say the word and I'll build them):
   - **AI Security Research Toolkit** → live prompt-injection / jailbreak playground (eats its own dogfood).
   - **Interview Prep Engine** → adaptive question generation + AI grader against your rubrics.
2. Rewrite the landing page footer — current copy says *"no data leaves your machine"* but that no longer holds for AI-enabled apps. Recommend a per-card badge: "🔒 Local-only" vs. "🤖 Calls Gemini".

## Cost note

Firebase Hosting is free up to 10 GB/month transfer. Firebase AI Logic via the Gemini Developer API has a free tier; if traffic grows, swap to the Vertex AI backend (single line change in `ai-config.js`) and pay per-call. App Check + reCAPTCHA Enterprise keeps unauthenticated abuse off your quota.
