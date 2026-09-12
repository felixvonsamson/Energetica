#!/bin/bash
# Shared by deploy-instance.sh and deploy-lobby.sh: build the backend wheel here, install it
# into the service virtual environment there.
#
#   build_backend_wheel                          # writes dist/<wheel> at the repo root,
#                                                # and sets BACKEND_WHEEL to its filename
#   install_backend_wheel <ssh-target> <remote-path>
#
# The backend lives under src/ and is imported as an installed package, so this step is not
# optional: a deploy that skips it leaves the service unable to import `energetica` at all.
#
# The wheel is built on the deploy machine rather than on the server for two reasons. The
# instance directory is deploy-owned and only group-readable by the service user (2750, see
# setup-instance.sh), and `pip install <directory>` builds in-tree — it would try to write
# build/ and energetica.egg-info/ (setuptools' scratch metadata for the wheel build, not the
# retired egg distribution format) into a directory the service user cannot write. And building
# here means the server needs no build backend and no compiler. The wheel is pure Python
# (py3-none-any), so building it on a developer's machine and installing it on the server is
# not a cross-platform problem.
#
# Both callers build the wheel before their confirmation prompt and regardless of --skip-build:
# that flag is about the slow frontend bundle, and the service cannot start without the backend
# package installed, so a broken build should stop the deploy before anything ships.

# scripts/lib/backend-wheel.sh -> scripts/lib -> scripts -> repo root.
_BACKEND_WHEEL_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# The wheel's filename, set by build_backend_wheel and read by install_backend_wheel. Passing
# the exact name rather than re-globbing on the server means the two steps cannot disagree.
BACKEND_WHEEL=""

build_backend_wheel() {
    # The project venv on a developer's machine, as everywhere else in this repo. CI has no
    # .venv — it installs against the interpreter already on PATH — so fall back to that.
    local python="$_BACKEND_WHEEL_REPO_ROOT/.venv/bin/python"
    if [ ! -x "$python" ]; then
        python="$(command -v python3 || true)"
    fi
    [ -n "$python" ] || {
        log_error "No Python found to build the backend wheel. Create the project venv — see docs/getting-started/installation.md."
        exit 1
    }

    local dist_dir="$_BACKEND_WHEEL_REPO_ROOT/dist"
    log_step "Building backend wheel..."
    # Clear every artifact of a previous build, not just the wheel.
    #
    # dist/ so the directory holds exactly one wheel: the project version rarely changes between
    # deploys, so a previous build leaves a same-named file behind and there is no way to tell
    # which one was just built.
    #
    # build/ because setuptools assembles the wheel from build/lib rather than from the source
    # tree, and it copies into that directory without ever pruning it. A file deleted or renamed
    # since the last build is still sitting there and still ships — the wheel silently stops
    # matching the source tree, and the first sign of it is on the server. The same staleness
    # also re-adds files that the current package-data configuration excludes.
    #
    # The .egg-info directory for the same reason: its SOURCES.txt is regenerated from whatever
    # the previous build left behind.
    rm -rf "$dist_dir" "$_BACKEND_WHEEL_REPO_ROOT/build" "$_BACKEND_WHEEL_REPO_ROOT"/src/*.egg-info
    "$python" -m pip wheel --quiet --no-deps --wheel-dir "$dist_dir" "$_BACKEND_WHEEL_REPO_ROOT" || {
        log_error "Backend wheel build failed"
        exit 1
    }
    BACKEND_WHEEL="$(basename "$dist_dir"/*.whl)"

    # The server installs the wheel as the `energetica` service user, but the instance tree is
    # 2750 deploy:energetica — so the service user reaches the wheel through the group bit only.
    # `rsync -a` preserves local permissions, so a developer with a restrictive umask (pip writes
    # the wheel 0600 under umask 077) would ship a file the service user cannot read, failing
    # every deploy at the install step. Normalise locally and let `rsync -a` carry the result
    # across, exactly as deploy-lobby.sh does for the SPA bundle: dirs 755, files 644. rsync's
    # --chmod would do this during transfer, but macOS ships openrsync, which rejects it.
    chmod -R u=rwX,g=rX,o=rX "$dist_dir"

    log_success "Backend wheel built ($BACKEND_WHEEL)"
}

# Install the wheel that the code rsync carried to <remote-path>/dist, as the service user.
install_backend_wheel() {
    local ssh_target="$1" remote_path="$2"
    [ -n "$BACKEND_WHEEL" ] || {
        log_error "install_backend_wheel called before build_backend_wheel — nothing to install."
        exit 1
    }

    local pip="sudo -u energetica $remote_path/.venv/bin/pip"
    local wheel="$remote_path/dist/$BACKEND_WHEEL"

    log_step "Installing the backend into the server venv..."
    # Two steps, because neither alone is both correct and cheap.
    #
    # The project's own code is installed with --force-reinstall --no-deps, unconditionally. The
    # version usually does not change between deploys, and pip skips a wheel whose version is
    # already installed ("energetica is already installed with the same version as the provided
    # wheel") — so without --force-reinstall the deploy would report success and ship no new code.
    #
    # The dependencies are then installed only when they are actually missing. `pip check` is what
    # asks that question: a newly added dependency shows up there as unsatisfied, and the full
    # install that follows fixes it. Installing them unconditionally instead would mean every
    # deploy needs PyPI reachable even when nothing changed, which the previous
    # requirements.txt-based step did not. Note that `pip check` reports any broken requirement in
    # the venv, not just ours, so a pre-existing conflict makes this take the slow path every time
    # — slower, never wrong.
    ssh "$ssh_target" "$pip install -q --force-reinstall --no-deps $wheel && { $pip check >/dev/null || $pip install -q --force-reinstall $wheel; }" || {
        log_error "Installing the backend into $remote_path/.venv failed — not restarting the service."
        exit 1
    }
    log_success "Backend installed"
}
