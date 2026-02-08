#!/bin/sh

# Certbot service with automatic nginx reload via shared signal file
# This script runs continuously, checking for certificate renewals every 12 hours.
# When certificates are renewed, it creates a signal file that triggers nginx reload.

set -e

echo "Starting certbot renewal service..."

# Shared signal directory
SIGNAL_DIR="/tmp/certbot-signals"
RELOAD_SIGNAL="$SIGNAL_DIR/reload-nginx"

# Create signal directory if it doesn't exist
mkdir -p "$SIGNAL_DIR"

# Set up signal trap for clean shutdown
trap exit TERM

# Main loop - runs forever
while :; do
  echo "Running certbot renew at $(date)..."

  # Attempt certificate renewal with deploy hook
  # The deploy hook only runs when certificates are actually renewed
  certbot renew --deploy-hook "touch $RELOAD_SIGNAL && echo 'Certificate renewed - signal file created'"

  echo "Next check in 12 hours..."
  echo "---"

  sleep 12h & wait ${!}
done
