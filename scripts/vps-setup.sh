#!/bin/bash
set -e

# Energetica VPS One-Time Setup Script
# Run this on your VPS to set up Apache, Let's Encrypt, and the FastAPI backend
# Usage: bash vps-setup.sh

# Configuration
DOMAIN="energetica-game.org"
APP_PATH="/var/www/energetica"
DEPLOY_USER="deploy"
APP_USER="www-data"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() {
    echo -e "${YELLOW}→ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "This script must be run as root (use: sudo bash vps-setup.sh)"
    exit 1
fi

log_section "ENERGETICA VPS SETUP"

# Step 1: Update system
log_step "Updating system packages..."
apt update
apt upgrade -y
log_success "System updated"

# Step 2: Install dependencies
log_section "INSTALLING DEPENDENCIES"

log_step "Installing Apache..."
apt install -y apache2
log_success "Apache installed"

log_step "Installing Python and build tools..."
apt install -y python3 python3-venv python3-dev build-essential
log_success "Python dependencies installed"

log_step "Installing Node.js (for rollback frontend rebuilds)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
log_success "Node.js installed"

log_step "Installing certbot and Let's Encrypt..."
apt install -y certbot python3-certbot-apache
log_success "Certbot installed"

log_step "Installing other tools..."
apt install -y git curl wget rsync
log_success "Tools installed"

# Step 3: Enable Apache modules
log_section "CONFIGURING APACHE"

log_step "Enabling Apache modules..."
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod ssl
a2enmod headers
a2enmod rewrite
systemctl restart apache2
log_success "Apache modules enabled"

# Step 4: Create deployment user
log_section "SETTING UP DEPLOYMENT USER"

log_step "Creating deploy user..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
    log_success "Deploy user created: $DEPLOY_USER"
else
    log_success "Deploy user already exists: $DEPLOY_USER"
fi

log_step "Configuring passwordless sudo for deploy user..."
# Use sudoers.d for cleaner, safer configuration
SUDOERS_FILE="/etc/sudoers.d/energetica-deploy"

# Check if already configured
if [ -f "$SUDOERS_FILE" ]; then
    log_success "Sudo configuration already exists"
else
    # Create sudoers.d entry with minimal, specific permissions
    # Allow: git pull as www-data, and service management
    cat > "$SUDOERS_FILE" << EOF
    $DEPLOY_USER ALL=(www-data) NOPASSWD: /usr/bin/git -C $APP_PATH pull origin *, /bin/rm -r $APP_PATH/instance
    $DEPLOY_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart energetica, /bin/systemctl status energetica, /bin/systemctl is-active *, /usr/bin/journalctl -u energetica*
    EOF
    chmod 440 "$SUDOERS_FILE"

    # Validate sudoers syntax
    if visudo -c -f "$SUDOERS_FILE" 2>/dev/null; then
        log_success "Passwordless sudo configured (git as www-data, service restart)"
    else
        log_error "Failed to configure sudoers - invalid syntax"
        exit 1
    fi
fi

# Step 5: Set up application directory
log_section "SETTING UP APPLICATION DIRECTORY"

log_step "Creating application directory..."
mkdir -p "$APP_PATH"
chown "$DEPLOY_USER:$APP_USER" "$APP_PATH"
chmod 750 "$APP_PATH"
log_success "Application directory created: $APP_PATH"

log_step "Cloning repository..."
REPO_URL="https://github.com/felixvonsamson/Energetica"
echo "Repository: $REPO_URL"

# Get available branches
log_step "Fetching available branches..."
BRANCHES=$(git ls-remote --heads "$REPO_URL" | awk '{print $2}' | sed 's|refs/heads/||' | sort)

# Convert to array
IFS=$'\n' read -rd '' -a BRANCH_ARRAY <<<"$BRANCHES" || true

if [ ${#BRANCH_ARRAY[@]} -eq 0 ]; then
    echo -e "${RED}ERROR: Could not fetch branches from repository${NC}"
    exit 1
fi

# Interactive branch selection using select
log_section "SELECT BRANCH"
echo "Available branches:"
echo ""
select SELECTED_BRANCH in "${BRANCH_ARRAY[@]}"; do
    if [ -n "$SELECTED_BRANCH" ]; then
        log_success "Selected branch: $SELECTED_BRANCH"
        break
    else
        echo -e "${RED}Invalid selection. Please try again.${NC}"
    fi
done

cd "$APP_PATH"
sudo -u "$DEPLOY_USER" git clone --branch "$SELECTED_BRANCH" "$REPO_URL" .
log_success "Repository cloned (branch: $SELECTED_BRANCH)"

log_step "Configuring git permissions..."
sudo -u "$DEPLOY_USER" git config --add safe.directory "$APP_PATH"
chown -R "$DEPLOY_USER:$APP_USER" "$APP_PATH/.git"
chmod -R u+rw,g+r "$APP_PATH/.git"
log_success "Git permissions configured"

# Step 6: Set up Python environment
log_section "SETTING UP PYTHON ENVIRONMENT"

log_step "Creating Python virtual environment..."
sudo -u "$DEPLOY_USER" python3 -m venv "$APP_PATH/.venv"
log_success "Virtual environment created"

log_step "Installing Python dependencies..."
if ! sudo -u "$DEPLOY_USER" "$APP_PATH/.venv/bin/pip" install --upgrade pip; then
    log_error "Failed to upgrade pip"
    exit 1
fi

if ! sudo -u "$DEPLOY_USER" "$APP_PATH/.venv/bin/pip" install -r "$APP_PATH/requirements.txt"; then
    log_error "Failed to install Python dependencies from requirements.txt"
    exit 1
fi
log_success "Python dependencies installed"

log_step "Setting venv permissions for www-data..."
chmod -R g+rx "$APP_PATH/.venv"
log_success "Virtual environment readable by www-data"

# Step 7: Create systemd service
log_section "SETTING UP SYSTEMD SERVICE"

log_step "Creating systemd service file..."
cat > /etc/systemd/system/energetica.service << 'EOF'
[Unit]
Description=Energetica FastAPI Game Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/energetica
Environment="PATH=/var/www/energetica/.venv/bin"
ExecStart=/var/www/energetica/.venv/bin/python main.py --env prod --port 8000 --no-reload --fastapi-log-level warning
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

log_success "Systemd service file created"

log_step "Enabling and starting service..."
systemctl daemon-reload
systemctl enable energetica
systemctl start energetica
log_success "Energetica service started"

# Verify service is running
sleep 2
if ! systemctl is-active --quiet energetica; then
    echo -e "${RED}ERROR: Service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u energetica -n 50"
    exit 1
fi

# Step 8: Set up SSL with Let's Encrypt
log_section "SETTING UP SSL WITH LET'S ENCRYPT"

# Check if certificate already exists
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_success "SSL certificate already exists for $DOMAIN - skipping setup"
else
    log_step "Obtaining SSL certificate for $DOMAIN..."
    echo "Make sure your domain is pointing to this VPS before proceeding."
    read -p "Is $DOMAIN pointing to this server? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please configure your DNS first, then run: sudo certbot --apache -d $DOMAIN"
        exit 1
    fi

    certbot --apache -d "$DOMAIN"
    log_success "SSL certificate obtained"
fi

# Step 9: Create Apache Virtual Host
log_section "SETTING UP APACHE VIRTUAL HOST"

log_step "Creating Apache configuration..."
cat > /etc/apache2/sites-available/energetica.conf << EOF
<VirtualHost *:80>
    ServerName $DOMAIN

    # Redirect all HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}\$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName $DOMAIN

    # SSL Configuration (auto-managed by certbot)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem
    SSLProtocol TLSv1.2 TLSv1.3
    SSLCipherSuite HIGH:!aNULL:!MD5

    # Security Headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"

    # Proxy Settings
    ProxyPreserveHost On
    ProxyTimeout 300

    # API Endpoints
    ProxyPass /api http://localhost:8000/api
    ProxyPassReverse /api http://localhost:8000/api

    # Socket.IO WebSocket Support
    ProxyPass /socket.io http://localhost:8000/socket.io
    ProxyPassReverse /socket.io http://localhost:8000/socket.io

    # WebSocket upgrade for Socket.IO
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} ^websocket$ [NC]
    RewriteCond %{HTTP:CONNECTION} Upgrade$ [NC]
    RewriteRule /socket.io/(.*)$ ws://127.0.0.1:8000/socket.io/\$1 [P,L]

    # Auth and other backend routes
    ProxyPass /logout http://localhost:8000/logout
    ProxyPassReverse /logout http://localhost:8000/logout

    ProxyPass /location_choice http://localhost:8000/location_choice
    ProxyPassReverse /location_choice http://localhost:8000/location_choice

    # Static files
    ProxyPass /static http://localhost:8000/static
    ProxyPassReverse /static http://localhost:8000/static

    # React app (catch-all)
    ProxyPass / http://localhost:8000/
    ProxyPassReverse / http://localhost:8000/

    # Logging
    ErrorLog \${APACHE_LOG_DIR}/energetica-error.log
    CustomLog \${APACHE_LOG_DIR}/energetica-access.log combined
</VirtualHost>
EOF

log_success "Apache configuration created"

log_step "Enabling site and testing configuration..."
a2ensite energetica 2>/dev/null || true

# Disable the auto-generated Let's Encrypt default config to avoid conflicts
log_step "Disabling default Let's Encrypt config..."
a2dissite 000-default-le-ssl 2>/dev/null || true

apache2ctl configtest
systemctl reload apache2
log_success "Apache configuration applied"

# Step 10: Set up Firewall
log_section "SETTING UP FIREWALL"

log_step "Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
log_success "Firewall configured"

# Step 11: Set up directory permissions
log_section "SETTING UP DIRECTORY PERMISSIONS"

log_step "Setting www-data as owner with www-data group, deploy as member..."
chown -R "$APP_USER:$APP_USER" "$APP_PATH"
usermod -a -G "$APP_USER" "$DEPLOY_USER"
find "$APP_PATH" -type d -exec chmod 2770 {} \;
find "$APP_PATH" -type f -exec chmod 660 {} \;
log_success "Ownership and permissions configured (www-data owner, group write enabled for deploy user)"

# Step 12: Verify setup
log_section "VERIFYING SETUP"

log_step "Checking services..."
echo "Energetica service:"
systemctl status energetica --no-pager | grep -E "(Active|Loaded)" || true

echo ""
echo "Apache service:"
systemctl status apache2 --no-pager | grep -E "(Active|Loaded)" || true

log_step "Testing backend health..."
if curl -s http://localhost:8000/api/ > /dev/null; then
    log_success "Backend is responding"
else
    echo -e "${RED}WARNING: Backend not responding, this is expected if it's still initializing${NC}"
fi

# Done!
log_section "SETUP COMPLETE"

echo ""
echo "Your Energetica server is now configured!"
echo ""
echo "Next steps:"
echo "1. From your local machine, build the frontend: cd frontend && npm run build"
echo "2. Deploy with: ./scripts/deploy.sh"
echo ""
echo "Useful commands:"
echo "  Check status:   sudo systemctl status energetica"
echo "  View logs:      sudo journalctl -u energetica -f"
echo "  Restart:        sudo systemctl restart energetica"
echo "  Apache logs:    tail -f /var/log/apache2/energetica-error.log"
echo ""
echo "Website: https://$DOMAIN"
echo ""
