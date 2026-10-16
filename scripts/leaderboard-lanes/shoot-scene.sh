#!/bin/sh
# Screenshots of the scene-art galleries with agent-browser (own session), over a throwaway local server (external
# <use> references need http, not file://). Downscaled copies go to /tmp/ll for reading.
# usage: scripts/leaderboard-lanes/shoot-scene.sh <tag> [zoom]
set -e
export AGENT_BROWSER_SESSION=lanes-scene
ROOT="$PWD/.scratch/leaderboard-lanes/scene"
DIR="$ROOT/shots"
TAG="$1"; ZOOM="${2:-1}"
mkdir -p "$DIR" /tmp/ll
PORT=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1])")
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
for page in gallery zoom; do for t in light dark; do
  agent-browser open "http://127.0.0.1:$PORT/$page-$t.html" >/dev/null
  agent-browser set viewport 1900 1400 2 >/dev/null
  agent-browser eval "document.body.style.zoom=$ZOOM" >/dev/null
  sleep 5
  agent-browser screenshot --full "$DIR/$TAG-$page-$t.png" >/dev/null
  sips -Z 1800 "$DIR/$TAG-$page-$t.png" --out "/tmp/ll/$TAG-$page-$t.png" >/dev/null
done; done
agent-browser close >/dev/null 2>&1 || true
ls /tmp/ll | grep "^$TAG-"
