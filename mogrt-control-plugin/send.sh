#!/bin/bash
# send.sh — send a JSON command to the MOGRT Control UXP plugin and print result.
# Usage: ./send.sh '{"cmd": "ping"}'
#        ./send.sh '{"cmd": "listMogrts"}'

set -euo pipefail

DATA_DIR="/Users/tlkorjak/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO/26/Developer/tv.promots.mogrt-control/PluginData"
CMD_FILE="$DATA_DIR/cmd.json"
RESULT_FILE="$DATA_DIR/result.json"
# Poll every 250ms, total timeout 30s = 120 iterations
MAX_ITERS=120

CMD="${1:-}"
if [[ -z "$CMD" ]]; then
  echo "usage: $0 '<json command>'" >&2
  exit 2
fi

rm -f "$RESULT_FILE"
echo "$CMD" > "$CMD_FILE"

i=0
while [[ $i -lt $MAX_ITERS ]]; do
  if [[ -f "$RESULT_FILE" ]]; then
    cat "$RESULT_FILE"
    exit 0
  fi
  sleep 0.25
  i=$((i+1))
done

echo '{"error":"timeout — is the plugin loaded in PPro?"}' >&2
exit 1
