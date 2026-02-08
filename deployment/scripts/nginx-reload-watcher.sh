#!/bin/sh

# Nginx reload watcher
# This script monitors a shared signal file and reloads nginx when it's created.
# This allows certbot to trigger nginx reload without requiring Docker socket access.

set -e

echo "Starting nginx reload watcher..."

# Shared signal directory
SIGNAL_DIR="/tmp/certbot-signals"
RELOAD_SIGNAL="$SIGNAL_DIR/reload-nginx"

# Create signal directory if it doesn't exist
mkdir -p "$SIGNAL_DIR"

# Set up signal trap for clean shutdown
trap exit TERM

echo "Watching for reload signals at $RELOAD_SIGNAL"

# Main loop - check for signal file every 10 seconds
while :; do
  if [ -f "$RELOAD_SIGNAL" ]; then
    echo "Reload signal detected at $(date)"

    # Remove the signal file
    rm -f "$RELOAD_SIGNAL"

    # Reload nginx
    if nginx -s reload; then
      echo "nginx reloaded successfully at $(date)"
    else
      echo "ERROR: Failed to reload nginx" >&2
    fi
  fi

  sleep 10
done
