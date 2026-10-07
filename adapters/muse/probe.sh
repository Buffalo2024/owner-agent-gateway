#!/usr/bin/env bash
# Owner-selected public signal URL. No token, task body, IDs or caller data.
set -euo pipefail
source "${HATCH_HOOK_RUNTIME:?Missing Muse hook runtime}"
url="${AD_SIGNAL_URL:?Set the public signal URL in owner-controlled hook configuration}"
if [[ "$url" != https://* ]]; then silent "invalid probe configuration"; exit 0; fi
if ! body=$(curl --fail --silent --show-error --proto '=https' --max-time 10 --max-filesize 1024 "$url" 2>/dev/null); then
  silent "signal unavailable"; exit 0
fi
if printf '%s' "$body" | python3 -c 'import json,sys; v=json.load(sys.stdin); sys.exit(0 if type(v) is dict and set(v)=={"available"} and v["available"] is True else 1)' 2>/dev/null; then
  wake "task_available" '{"protocol":"agent-dispatch/0.1"}'
else
  silent "no task"
fi
