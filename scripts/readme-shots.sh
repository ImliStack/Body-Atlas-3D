#!/bin/bash
# Refresh every README screenshot (docs/screenshots/*.jpg) from the running dev server.
# Needs: `npm run dev` on :5180 and the gstack `browse` CLI in headed mode (WebGL needs a real GPU).
# Usage: scripts/readme-shots.sh
set -u
cd "$(dirname "$0")/.."
OUT=docs/screenshots
BROWSE="${BROWSE:-$HOME/.claude/skills/gstack/browse/dist/browse}"
b() { "$BROWSE" --headed "$@"; }
n=0
A="window.__atlas.getState()"

# prefs <theme> [left panel] [right panel] [pins json]
prefs() {
  b js "localStorage.setItem('atlas-theme','$1'); localStorage.setItem('atlas-panels', JSON.stringify({left:${2:-true},right:${3:-true}})); localStorage.setItem('atlas-pins', '${4:-[]}'); localStorage.setItem('atlas-hq','true'); localStorage.removeItem('atlas-folds'); 'ok'" >/dev/null
}

# shot <name> <hash> <seconds to settle> [js…]
shot() {
  local name=$1 url=$2 wait=$3; shift 3
  n=$((n+1))
  b js "localStorage.setItem('atlas-pins','[]'); 'ok'" >/dev/null
  b goto "http://localhost:5180/?s=$n$url" >/dev/null 2>&1 || { sleep 2; b goto "http://localhost:5180/?s=$n$url" >/dev/null; }
  for i in $(seq 1 30); do sleep 1; r=$(b js "!document.querySelector('.search input').disabled" 2>/dev/null | tail -1); [ "$r" = "true" ] && break; done
  sleep 1
  for j in "$@"; do b js "$j" >/dev/null; sleep 0.4; done
  sleep "$wait"
  b screenshot --viewport "$OUT/$name.png" >/dev/null
  sips -s format jpeg -s formatOptions 82 "$OUT/$name.png" --out "$OUT/$name.jpg" >/dev/null && rm "$OUT/$name.png"
  echo "ok $name"
}

front="$A.autoRotate && $A.toggleAutoRotate(); $A.view('front'); 'x'"

b viewport 1440x900 >/dev/null
b goto "http://localhost:5180/" >/dev/null
prefs light
shot overview-light "" 3 "$front" "$A.togglePins(); 'x'"
shot exploded "" 4 "$front" "$A.togglePins(); 'x'" "$A.toggleExplode(); 'x'"
shot skull-exploded "#featured/skull" 4 "$A.autoRotate && $A.toggleAutoRotate(); 'x'" "$A.setExplodeAmount(0.8); $A.toggleExplode(); 'x'"
shot region-upper "#region/upper" 3 "$front" "$A.toggleSystem('muscular'); 'x'"
shot opacity "" 3 "$front" "$A.toggleOpacityOpen(); $A.toggleSystem('muscular'); $A.setOpacity('muscular', 0.3); $A.setOpacity('skeletal', 0.55); 'x'"
shot heart-structure "#organ/heart" 6 "$A.selectStructure('left-ventricle'); 'x'"
shot quiz "" 3 "$A.startQuiz(); 'x'"
shot xray "" 3 "$front" "$A.toggleXray(); $A.toggleSystem('muscular'); 'x'"
b goto "http://localhost:5190/systems/nervous/" >/dev/null 2>&1 && sleep 2 && b screenshot --viewport "$OUT/system-page.png" >/dev/null && sips -s format jpeg -s formatOptions 82 "$OUT/system-page.png" --out "$OUT/system-page.jpg" >/dev/null && rm "$OUT/system-page.png" && echo "ok system-page (needs npm run build + preview on :5190)"
b goto "http://localhost:5180/" >/dev/null
prefs dark
shot overview-dark "" 3 "$front" "$A.togglePins(); 'x'"
shot brain-dark "#organ/brain" 6
n=$((n+1)); b goto "http://localhost:5180/?s=$n" >/dev/null; sleep 6
b click ".search input" >/dev/null; b type "femur" >/dev/null; sleep 1
b screenshot --viewport "$OUT/search-dark.png" >/dev/null
sips -s format jpeg -s formatOptions 82 "$OUT/search-dark.png" --out "$OUT/search-dark.jpg" >/dev/null && rm "$OUT/search-dark.png"; echo "ok search-dark"
prefs light false false
shot focus-mode "#region/head" 4
prefs light
b viewport 390x844 >/dev/null
shot mobile "#organ/lungs" 6
b viewport 1440x900 >/dev/null
