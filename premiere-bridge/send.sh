#!/bin/bash
# send.sh — send a command to the Premiere Bridge UXP plugin and print the result.
#
# Usage:
#   ./send.sh '{"cmd":"ping"}'                 # inline JSON
#   ./send.sh --json path/to/cmd.json          # raw JSON command from a file
#   ./send.sh --eval path/to/code.js           # wrap a .js file as {"cmd":"eval","code":...}
#
# The plugin must be loaded in Premiere Pro (UDT → Add Plugin → Load) and the
# panel open. The IPC folder is the plugin's UXP data folder; if the plugin logs
# a different path on boot, update DATA_DIR below to match.

set -euo pipefail

DATA_DIR="/Users/tlkorjak/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO/26/Developer/tv.promots.premiere-bridge/PluginData"
CMD_FILE="$DATA_DIR/cmd.json"
RESULT_FILE="$DATA_DIR/result.json"
TMP_FILE="$DATA_DIR/cmd.json.tmp"
MAX_ITERS=240   # 0.25s * 240 = 60s

mode="${1:-}"
if [[ -z "$mode" ]]; then
  echo "usage: send.sh '<json>' | --eval <file.js> | --json <file.json>" >&2
  exit 2
fi

mkdir -p "$DATA_DIR"

case "$mode" in
  --eval)
    CODE_FILE="${2:?usage: send.sh --eval <file.js>}"
    python3 -c 'import json,sys; print(json.dumps({"cmd":"eval","code":open(sys.argv[1]).read()}))' "$CODE_FILE" > "$TMP_FILE"
    ;;
  --json)
    JSON_FILE="${2:?usage: send.sh --json <file.json>}"
    cp "$JSON_FILE" "$TMP_FILE"
    ;;
  *)
    printf '%s' "$mode" > "$TMP_FILE"
    ;;
esac

rm -f "$RESULT_FILE"
mv -f "$TMP_FILE" "$CMD_FILE"   # atomic: plugin never reads a half-written cmd

i=0
while [[ $i -lt $MAX_ITERS ]]; do
  if [[ -f "$RESULT_FILE" ]]; then
    cat "$RESULT_FILE"; echo
    exit 0
  fi
  sleep 0.25
  i=$((i+1))
done

echo '{"error":"timeout — is Premiere Bridge loaded and the panel open?"}' >&2
exit 1
