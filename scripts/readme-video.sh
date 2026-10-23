#!/bin/bash
# Record the README demo (docs/demo.mp4 + docs/demo.gif) by capturing frames from the running
# dev server with the gstack `browse` CLI (headed, for WebGL) and encoding them with ffmpeg.
set -u
cd "$(dirname "$0")/.."
BROWSE="${BROWSE:-$HOME/.claude/skills/gstack/browse/dist/browse}"
b() { "$BROWSE" --headed "$@"; }
F=.frames && rm -rf .frames && mkdir -p .frames  # browse may only write inside the project
i=0
A="window.__atlas.getState()"
# cap <seconds>: grab frames as fast as the browser allows
cap() {
  local end=$(( $(date +%s) + $1 ))
  while [ "$(date +%s)" -lt "$end" ]; do
    i=$((i+1)); b screenshot --viewport "$(printf '%s/f%05d.jpg' "$F" "$i")" >/dev/null
  done
}
js() { b js "$1" >/dev/null; }

b viewport 1280x800 >/dev/null
b goto "http://localhost:5180/?rec=$RANDOM" >/dev/null
js "localStorage.setItem('atlas-theme','light'); localStorage.setItem('atlas-panels', JSON.stringify({left:true,right:true})); localStorage.setItem('atlas-pins','[]'); localStorage.setItem('atlas-hq','true'); localStorage.removeItem('atlas-folds'); 'ok'"
b goto "http://localhost:5180/?rec=$RANDOM" >/dev/null
for k in $(seq 1 30); do sleep 1; [ "$(b js "!document.querySelector('.search input').disabled" 2>/dev/null | tail -1)" = "true" ] && break; done
sleep 1
start=$(date +%s)
cap 4                                                                                   # turntable
js "$A.toggleAutoRotate(); $A.view('front'); 'ok'"; cap 2
js "$A.togglePins(); 'ok'"; cap 3                                                       # pinned labels
js "$A.toggleExplode(); 'ok'"; cap 4                                                    # exploded view
js "$A.setExplodeAmount(1); $A.fitExplode(); 'ok'"; cap 2
js "$A.toggleExplode(); $A.togglePins(); $A.showRegion('head'); 'ok'"; cap 3           # regions
js "$A.showRegion('upper'); $A.toggleSystem('muscular'); 'ok'"; cap 3
js "$A.showAll(); $A.view('front'); $A.toggleOpacityOpen(); $A.toggleSystem('muscular'); 'ok'"; cap 1
for v in 0.8 0.6 0.4 0.25; do js "$A.setOpacity('muscular', $v); 'ok'"; cap 1; done     # per-layer opacity
js "$A.toggleOpacityOpen(); $A.resetOpacity(); $A.toggleSystem('muscular'); $A.selectFeatured('skull'); 'ok'"; cap 2
js "$A.setExplodeAmount(0.8); $A.toggleExplode(); 'ok'"; cap 4                          # skull spread apart
js "$A.toggleExplode(); $A.openOrgan('heart'); 'ok'"; cap 4                             # organ deep-dive
js "$A.selectStructure('left-ventricle'); 'ok'"; cap 3
js "$A.clearSelection(); 'ok'"; cap 2
js "$A.togglePanel('focus'); 'ok'"; cap 3                                               # focus mode
js "$A.togglePanel('focus'); 'ok'"; cap 1
secs=$(( $(date +%s) - start ))
fps=$(python3 -c "print(max(4, round($i / $secs, 2)))")
echo "frames $i over ${secs}s → ${fps} fps"
ffmpeg -y -loglevel error -framerate "$fps" -i "$F/f%05d.jpg" -vf "scale=1280:-2,fps=24" -c:v libx264 -pix_fmt yuv420p -crf 26 -movflags +faststart docs/demo.mp4
ffmpeg -y -loglevel error -framerate "$fps" -i "$F/f%05d.jpg" -vf "fps=7,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" docs/demo.gif
ls -la docs/demo.mp4 docs/demo.gif
rm -rf "$F"
