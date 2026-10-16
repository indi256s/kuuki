#!/bin/sh
# Screenshots of the fleet gallery with agent-browser (own session), over a throwaway local server (external <use>
# references need http, not file://). Downscaled copies go to /tmp/ll for reading.
# usage: scripts/leaderboard-lanes/shoot-fleet.sh <tag> [ICAO ...]   (ICAO list: 4x close-ups, default a few)
set -e
export AGENT_BROWSER_SESSION=lanes-gate-opus
ROOT="$PWD/.scratch/leaderboard-lanes"
DIR="$ROOT/fleet-shots"
TAG="$1"; shift
ZOOM="${*:-A21N A388 DH8B B788 B38M E170 SU95}"
mkdir -p "$DIR" /tmp/ll
PORT=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1])")
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
agent-browser open "http://127.0.0.1:$PORT/fleet.html" >/dev/null
agent-browser set viewport 1400 3200 2 >/dev/null; agent-browser wait 6000 >/dev/null
sleep 1
for t in dark light; do
  agent-browser screenshot "section[data-theme=$t] .card[data-size=s]" "$DIR/$TAG-$t-board-64@2x.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .card[data-size=l]" "$DIR/$TAG-$t-board-140@2x.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .grid.s" "$DIR/$TAG-$t-all-64@2x.png" >/dev/null
  agent-browser screenshot "section[data-theme=$t] .grid.l" "$DIR/$TAG-$t-all-140@2x.png" >/dev/null
done
if [ -f "$ROOT/fleet-mass100.html" ]; then
  agent-browser open "http://127.0.0.1:$PORT/fleet-mass100.html" >/dev/null
  sleep 1
  for t in dark light; do agent-browser screenshot "section[data-theme=$t] .card[data-size=s]" "$DIR/$TAG-$t-board-64-mass100@2x.png" >/dev/null; done
fi
agent-browser open "http://127.0.0.1:$PORT/fleet-lines.html" >/dev/null
agent-browser set viewport 1400 16000 1 >/dev/null
sleep 1
for k in $ZOOM; do for t in dark light; do agent-browser screenshot "section[data-theme=$t] .z[data-key=$k]" "$DIR/$TAG-$t-$k-4x.png" >/dev/null; done; done
for f in "$DIR/$TAG"-*.png; do sips -Z 1200 "$f" --out "/tmp/ll/$(basename "$f")" >/dev/null; done
ls /tmp/ll | grep "^$TAG-"
