#!/bin/bash
# Shared by deploy-instance.sh and deploy-lobby.sh: ship the backend to the server.
#
#   sync_backend <destination> <bundle-dir> <entry-point>...
#
# <destination> is an rsync target such as deploy@host:/var/www/energetica-lobby. <bundle-dir> is
# the app bundle directory the caller syncs separately (dist-app or dist-lobby). Each
# <entry-point> is a file at the repo root that a systemd unit runs from the working directory.
#
# This ships an allowlist, not the working tree: the entry points, and dist/$BACKEND_WHEEL, which
# install_backend_wheel (backend-wheel.sh) installs into the server venv. Everything else the
# services run comes from that installed wheel. Syncing the repo root with an exclude list used to
# ship whatever else sat in the deployer's checkout, untracked files included (#1363).
#
# The payload is assembled in a temporary staging directory, and the sync from there runs with
# --delete, so any file on the server that the payload does not contain is removed. That includes
# what older deploys shipped, such as src/ and docs/. The paths below are protected from --delete
# with `P` filter rules instead, because the server owns them or another step of the same deploy
# syncs them:
#
# - instance/ and checkpoints/: game state the service user writes at runtime.
# - .venv/: the server venv, which install_backend_wheel installs into.
# - scripts/: synced separately by each deploy script, from scripts/instance/ or scripts/lobby/.
# - DEPLOYED_VERSION.json: written by stamp_deployed_version after this sync.
# - .well-known/: where certbot answers ACME challenges (--webroot), so a deploy that overlaps a
#   certificate renewal must not delete them.
# - <bundle-dir>: the app bundle, synced separately with its own --delete.
#
# An --exclude rule would protect these too, but it is the wrong tool for the allowlist itself: an
# excluded path is also skipped by --delete, so stray files would never be removed. Both GNU rsync
# and the openrsync that macOS ships accept `P` rules.

# scripts/lib/backend-sync.sh -> scripts/lib -> scripts -> repo root.
_BACKEND_SYNC_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# The body runs in a subshell so the EXIT trap removes the staging directory however it ends,
# without replacing a trap the caller set.
sync_backend() (
    local destination="$1" bundle_dir="$2"
    shift 2
    [ -n "${BACKEND_WHEEL:-}" ] || {
        log_error "sync_backend called before build_backend_wheel — there is no wheel to ship."
        exit 1
    }

    local staging
    staging="$(mktemp -d)"
    # shellcheck disable=SC2064  # expand $staging now, while it is in scope
    trap "rm -rf '$staging'" EXIT

    mkdir "$staging/dist"
    cp "$_BACKEND_SYNC_REPO_ROOT/dist/$BACKEND_WHEEL" "$staging/dist/"
    local entry_point
    for entry_point in "$@"; do
        cp "$_BACKEND_SYNC_REPO_ROOT/$entry_point" "$staging/"
    done

    # The service user reaches the code through the `energetica` group only, and `rsync -a` carries
    # local modes across, so a deployer with a restrictive umask would ship files the service cannot
    # read. Normalise locally to dirs 755 and files 644, as build_backend_wheel does for the wheel:
    # macOS ships openrsync, which rejects rsync's --chmod. This covers the staging root too, which
    # rsync applies to the remote root. mktemp creates it 700, which would lock out the service and
    # Apache. 755 is what a default checkout's root gave it when the deploy synced the repo root.
    chmod -R u=rwX,g=rX,o=rX "$staging"

    log_step "Syncing backend code..."
    rsync -az --delete \
        --filter='P /instance/' \
        --filter='P /checkpoints/' \
        --filter='P /.venv/' \
        --filter='P /scripts/' \
        --filter='P /DEPLOYED_VERSION.json' \
        --filter='P /.well-known/' \
        --filter="P /$bundle_dir/" \
        "$staging/" "$destination/" >/dev/null
    log_success "Backend synced"
)
