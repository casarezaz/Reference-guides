#!/bin/bash
# Run this from the root of your local clone of casarezaz/Reference-guides.
# It adds the AI script tag to each of the 5 existing HTML files that have a retrofit.
# Idempotent — safe to re-run.

set -e

patches="
apt-investigation-tracker.html|apt-investigation-tracker-ai.js
threat-modeling-workbench.html|threat-modeling-workbench-ai.js
mitre-attack-explorer.html|mitre-attack-explorer-ai.js
ai-security-research-toolkit.html|ai-security-research-toolkit-ai.js
interview-prep-engine.html|interview-prep-engine-ai.js
"

echo "$patches" | while IFS='|' read -r html js; do
  if [ -z "$html" ]; then
    continue
  fi
  tag="<script type=\"module\" src=\"$js\"></script>"
  if [ ! -f "$html" ]; then
    echo "  ⚠ skip $html (file not found in this directory)"
    continue
  fi
  if grep -q "$js" "$html"; then
    echo "  ✓ already wired: $html"
    continue
  fi
  # Insert the tag right before </body>
  if grep -q "</body>" "$html"; then
    # macOS-compatible sed
    sed -i.bak "s|</body>|  $tag\n</body>|" "$html" && rm -f "$html.bak"
    echo "  + wired AI into: $html"
  else
    echo "  ⚠ no </body> in $html — append manually: $tag"
  fi
done

echo ""
echo "✓ AI retrofits wired. Now:"
echo "   git add ."
echo "   git commit -m 'Add Firebase + AI Field Lab + retrofits'"
echo "   git push"
echo "   firebase deploy --only hosting"
echo ""
echo "After deploy: https://threat-modeling-workbench.web.app"
