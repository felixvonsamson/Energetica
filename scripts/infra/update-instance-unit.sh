#!/bin/bash
set -euo pipefail

# Energetica — bring a provisioned instance's systemd unit and instance.env up to date. Run as
# root, on the server.
#
#   sudo bash scripts/infra/update-instance-unit.sh <instance>
#
# setup-instance.sh renders energetica.service and instance.env.tmpl once, and refuses to run twice
# on a provisioned instance. Deploys never touch either file, since both are root's (see
# setup-base.sh's least-privilege split). So a change to either template reaches a live instance
# only through this script, in the same way update-instance-vhost.sh carries vhost changes.
#
# What it does, idempotently:
#
# 1. Re-renders /etc/systemd/system/energetica-{instance}.service from energetica.service. The
#    unit substitutes only the instance's name, so this loses nothing.
# 2. Adds each variable instance.env.tmpl gained since the instance was set up and that its
#    instance.env lacks, with the template's fixed value. Existing lines, the port and clock values
#    above all, are left exactly as they are. Today that is ENERGETICA_LOBBY_SERVICE_SOCKET, which
#    tells the run where the lobby service listens (ADR-0009). Without it the run looks for a dev
#    socket and answers every request that needs an account with a 503.
# 3. Reloads systemd. It does not restart the instance: the next deploy does that, and
#    deploy-instance.sh refuses to deploy until this script has run.
#
# Deliver it the way the other infra scripts are delivered — there is no git on the server:
#
#   ./scripts/push-bootstrap.sh --server <ssh-host>                   # from your machine
#   sudo bash /tmp/update-instance-unit.sh <instance>                 # on the VPS, as root

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }

[ "$EUID" -eq 0 ] || { log_error "Must run as root"; exit 1; }
[ "$#" -eq 1 ] || { log_error "Usage: update-instance-unit.sh <instance>"; exit 1; }
INSTANCE="$1"

ENV_FILE="/etc/energetica/$INSTANCE/instance.env"
UNIT="/etc/systemd/system/energetica-$INSTANCE.service"
[ -f "$ENV_FILE" ] || { log_error "$ENV_FILE not found. Is $INSTANCE provisioned (setup-instance.sh)?"; exit 1; }
[ -f "$UNIT" ] || { log_error "$UNIT not found. Is $INSTANCE provisioned (setup-instance.sh)?"; exit 1; }

# --- 1. The unit ----------------------------------------------------------------
log_step "Rendering $UNIT..."
RENDERED="$(sed -e "s/@INSTANCE@/$INSTANCE/g" "$SCRIPT_DIR/energetica.service")"
if [ "$RENDERED" = "$(cat "$UNIT")" ]; then
    log_success "$UNIT is already current"
else
    printf '%s\n' "$RENDERED" > "$UNIT"
    log_success "Rendered $UNIT"
fi

# --- 2. instance.env -----------------------------------------------------------
# Variables whose value is the same on every instance, so they can be added without asking. A
# per-instance variable (the port, the clock values) can never be added here: it has no right
# value to guess.
FIXED_VARIABLES=(ENERGETICA_LOBBY_SERVICE_SOCKET)
for variable in "${FIXED_VARIABLES[@]}"; do
    if grep -q "^$variable=" "$ENV_FILE"; then
        log_success "$ENV_FILE already sets $variable"
        continue
    fi
    line="$(grep "^$variable=" "$SCRIPT_DIR/instance.env.tmpl")"
    printf '\n# Added by update-instance-unit.sh. See instance.env.tmpl.\n%s\n' "$line" >> "$ENV_FILE"
    log_success "Added $line to $ENV_FILE"
done

# --- 3. Reload ------------------------------------------------------------------
systemctl daemon-reload
log_success "systemd reloaded. Deploy $INSTANCE (deploy-instance.sh) to restart it with the new settings."
