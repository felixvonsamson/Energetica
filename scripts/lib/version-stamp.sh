#!/bin/bash
# Shared by deploy-instance.sh and deploy-lobby.sh: stamp the deployed backend version.
#
# The server carries no git checkout (deploys rsync with --exclude='.git'), so the running
# backend cannot report its own commit. The deploy machine does have git, so we capture the
# state here and write it to the deploy root as DEPLOYED_VERSION.json, which
# energetica/utils/version.py reads for /healthz. Both callers exclude this file from their
# rsync --delete so it survives between deploys and is simply overwritten each time.
#
#   stamp_deployed_version <ssh-target> <remote-path>

stamp_deployed_version() {
    local ssh_target="$1" remote_path="$2"
    local commit commit_short branch dirty deployed_by deployed_at

    commit=$(git rev-parse HEAD 2>/dev/null || echo "")
    commit_short=$(git rev-parse --short=9 HEAD 2>/dev/null || echo "")
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    # dirty means the deploy machine had uncommitted changes — the commit above may not be the
    # whole truth (a routine case: shipping a WIP frontend). It is repo-wide; git cannot cheaply
    # split it into backend vs frontend, and the frontend is stamped separately at build anyway.
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then dirty=true; else dirty=false; fi
    deployed_by=$(whoami)
    deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    log_step "Stamping deployed version ($commit_short, dirty=$dirty)..."
    # Build the JSON with a real encoder rather than interpolating shell values into a template:
    # git allows a branch name (and, in principle, a username) to contain a double quote or
    # backslash, which would produce invalid JSON that version.py rejects — leaving the host with
    # no reported version at all. Values are passed via the environment so the encoder, not the
    # shell, does the escaping. python3 is used (present wherever this repo builds); dirty is a
    # real JSON bool, the rest are strings.
    local json
    json=$(
        DV_COMMIT="$commit" DV_COMMIT_SHORT="$commit_short" DV_BRANCH="$branch" \
        DV_DIRTY="$dirty" DV_DEPLOYED_BY="$deployed_by" DV_DEPLOYED_AT="$deployed_at" \
        python3 -c '
import json, os
print(json.dumps({
    "commit": os.environ["DV_COMMIT"],
    "commit_short": os.environ["DV_COMMIT_SHORT"],
    "branch": os.environ["DV_BRANCH"],
    "dirty": os.environ["DV_DIRTY"] == "true",
    "deployed_by": os.environ["DV_DEPLOYED_BY"],
    "deployed_at": os.environ["DV_DEPLOYED_AT"],
    "source": "deploy",
}, indent=2))
'
    )
    # Piped over ssh so no version file is written locally. Default umask makes it world-readable,
    # which the service user (energetica) needs to read it for /healthz.
    printf '%s\n' "$json" | ssh "$ssh_target" "cat > $remote_path/DEPLOYED_VERSION.json"
    log_success "Stamped deployed version"
}
