#!/bin/sh
# Railway entrypoint for 9Router. Runs as root only long enough to give the
# volume to the unprivileged `node` user (as upstream's /entrypoint.sh does),
# then hands over to the launcher. Never exits because of a variable value.
set -u

DATA_DIR=/app/data

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR/home" "$DATA_DIR/db" 2>/dev/null \
    || echo "[railway] WARNING: could not create directories in $DATA_DIR" >&2
  chown -R node:node "$DATA_DIR" 2>/dev/null \
    || echo "[railway] WARNING: could not hand $DATA_DIR to the node user" >&2
  exec su-exec node node /opt/railway/launcher.mjs
fi

exec node /opt/railway/launcher.mjs
