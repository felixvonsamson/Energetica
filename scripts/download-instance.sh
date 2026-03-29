#!/bin/bash
set -e

REMOTE_HOST="${DEPLOY_HOST:-energetica-game-deploy}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
REMOTE_PATH="/var/www/energetica"
LOCAL_DEST="${1:-$HOME/Downloads}"

FILENAME="energetica-instance-$(date +%Y%m%d-%H%M%S).tar.gz"
REMOTE_TMP="/tmp/$FILENAME"

echo "→ Compressing instance on remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "tar -czf ${REMOTE_TMP} -C ${REMOTE_PATH} instance/"

echo "→ Downloading to ${LOCAL_DEST}/${FILENAME}..."
scp "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TMP}" "${LOCAL_DEST}/${FILENAME}"

echo "→ Cleaning up remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "rm ${REMOTE_TMP}"

echo "✓ Saved to ${LOCAL_DEST}/${FILENAME}"
