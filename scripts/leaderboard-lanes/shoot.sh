#!/bin/sh
# Screenshots of the gate page with agent-browser (own session), downscaled copies for reading.
# usage: scripts/leaderboard-lanes/shoot.sh <tag>
set -e
export AGENT_BROWSER_SESSION=lanes-gate-opus
DIR="$PWD/.scratch/leaderboard-lanes/gate-shots"
mkdir -p "$DIR"
agent-browser open "file://$PWD/.scratch/leaderboard-lanes/gate.html" >/dev/null
agent-browser set viewport 1400 3600 >/dev/null
for t in dark light; do
  agent-browser screenshot "section[data-theme=$t] .cols" "$DIR/$1-$t-lanes.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .row" "$DIR/$1-$t-liveries.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .row[data-size=s]" "$DIR/$1-$t-liveries-64.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .zoom" "$DIR/$1-$t-zoom.png" >/dev/null
done
for f in "$DIR/$1"-*.png; do sips -Z 1200 "$f" --out "/tmp/ll/$(basename "$f")" >/dev/null; done
ls /tmp/ll | grep "^$1-"
# 2× device pixels: the 390 px phone card and each 4× close-up
agent-browser set viewport 1400 3600 2 >/dev/null
for t in dark light; do
  agent-browser screenshot "section[data-theme=$t] .card[data-size=s]" "$DIR/$1-$t-phone@2x.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .card[data-size=l]" "$DIR/$1-$t-720@2x.png" >/dev/null
  for v in air rail road; do agent-browser screenshot "section[data-theme=$t] .z[data-key=$v]" "$DIR/$1-$t-$v-4x@2x.png" >/dev/null; done
done
