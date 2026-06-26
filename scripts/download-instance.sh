#!/bin/bash
set -euo pipefail

# Energetica — download an instance's game state (the `instance/` dir) for backup.
#
#   ./scripts/download-instance.sh --server <ssh-host> --instance <instance> \
#        [--user <ssh-user>] [--dest <local-dir>]
#
# Tars the instance's engine state on the server, scps it down, and cleans up the
# remote tarball. Game state lives at /var/www/energetica-{instance}/instance/.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
INSTANCE=""
LOCAL_DEST="$HOME/Downloads"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --instance) INSTANCE="$2"; shift 2 ;;
        --user) REMOTE_USER="$2"; shift 2 ;;
        --dest) LOCAL_DEST="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

[ -n "$REMOTE_HOST" ] || { echo "✗ --server is required (or set DEPLOY_HOST)"; exit 1; }
[ -n "$INSTANCE" ]    || { echo "✗ --instance is required"; exit 1; }

# Validate the slug — it is interpolated into the remote path and a tar command.
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || [ "$INSTANCE" = "landing" ]; then
    echo "✗ Invalid instance slug: '$INSTANCE' (lowercase kebab-case, not 'landing')"
    exit 1
fi

REMOTE_PATH="/var/www/energetica-$INSTANCE"
SSH="${REMOTE_USER}@${REMOTE_HOST}"
FILENAME="energetica-$INSTANCE-$(date +%Y%m%d-%H%M%S).tar.gz"
REMOTE_TMP="/tmp/$FILENAME"

echo "→ Compressing $INSTANCE state on $SSH..."
ssh "$SSH" "tar -czf ${REMOTE_TMP} -C ${REMOTE_PATH} instance/"

echo "→ Downloading to ${LOCAL_DEST}/${FILENAME}..."
scp "${SSH}:${REMOTE_TMP}" "${LOCAL_DEST}/${FILENAME}"

echo "→ Cleaning up remote..."
ssh "$SSH" "rm ${REMOTE_TMP}"

echo "✓ Saved to ${LOCAL_DEST}/${FILENAME}"
