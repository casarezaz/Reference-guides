# Reference-guides → Firebase Hosting deploy bundle

Everything in this bundle goes into the root of your local clone of
`casarezaz/Reference-guides`. `.firebaserc` is already committed (we did
that via the GitHub web UI earlier).

## What's in here

```
firebase.json                           ← Firebase Hosting config
ai-config.js                            ← Firebase + Gemini init (already wired with your project values)
index.html                              ← updated landing page with per-card AI badges
apt-investigation-tracker-ai.js         ← drop-in AI retrofit module
threat-modeling-workbench-ai.js         ← drop-in AI retrofit module
mitre-attack-explorer-ai.js             ← drop-in AI retrofit module
ai-security-research-toolkit-ai.js      ← drop-in AI retrofit module (LLM attack playground)
interview-prep-engine-ai.js             ← drop-in AI retrofit module
ai-field-lab/
  ├── ai-threat-hunt-builder.html       ← NEW Field Lab app (PEAK-style hunt planner)
  ├── ai-asset-blast-radius-mapper.html ← NEW Field Lab app (AI inventory + blast radius)
  └── ai-agent-evidence-lab.html        ← NEW Field Lab app (agent-trace reconstruction)
apply-ai-retrofits.sh                   ← inserts <script> tags into the 5 existing HTML files
.github/workflows/firebase-hosting-merge.yml  ← (optional) auto-deploy on git push
deploy.sh                               ← (optional) one-shot CLI deploy
firebase-deploy.md                      ← full deploy guide
```

## To deploy (5 commands, ~2 minutes)

```bash
# 1. From the root of your local clone of Reference-guides:
cd ~/path/to/Reference-guides

# 2. Extract the bundle on top (preserves your existing tools, adds new files,
#    overwrites only index.html):
unzip -o /path/to/deploy-bundle.zip

# 3. Patch the 5 existing HTML files to load their AI retrofit:
./apply-ai-retrofits.sh

# 4. Commit & push:
git add . && git commit -m "Add Firebase + AI Field Lab + retrofits" && git push

# 5. One-time CLI install + deploy:
npm install -g firebase-tools   # skip if already installed
firebase login                   # opens browser
firebase deploy --only hosting
```

Live URL after deploy: **https://threat-modeling-workbench.web.app**

## After deploy — smoke test

1. Open `https://threat-modeling-workbench.web.app/ai-field-lab/ai-threat-hunt-builder.html`
2. The status dot in the top-right should be GREEN.
3. Click "Sharpen with AI" with some sample text — Gemini should respond.

If the dot is yellow ("AI not configured"), double-check that `ai-config.js`
was uploaded correctly. It should have your real project ID
(`threat-modeling-workbench`) — not a `REPLACE_WITH_...` placeholder.
