#!/bin/sh
# PreToolUse(Bash): block kills that can hit another agent's server.
cmd=$(jq -r '.tool_input.command // empty')
if printf '%s' "$cmd" | grep -Eq '(^|[;&|(])[[:space:]]*(sudo[[:space:]]+)?(pkill|killall)([[:space:]]|$)|(^|[;&|(])[[:space:]]*kill[^;&|]*\$\([[:space:]]*(lsof|pgrep)'; then
  echo 'Blocked: pkill, killall and kill $(lsof|pgrep …) can stop servers other agents own. Stop the background task that started your server, or kill a PID you started yourself.' >&2
  exit 2
fi
exit 0
