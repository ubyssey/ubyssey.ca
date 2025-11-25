#!/bin/sh

# Certbot service with automatic nginx reload
# This script runs continuously, checking for certificate renewals every 12 hours
# and reloading nginx after each check (graceful reload has zero downtime).

set -e

echo "Starting certbot service with nginx auto-reload..."

# Install docker CLI (needed to communicate with nginx container)
echo "Installing docker-cli..."
apk add --no-cache docker-cli > /dev/null 2>&1
echo "docker-cli installed successfully"

# Set up signal trap for clean shutdown
trap exit TERM

# Main loop - runs forever
while :; do
  echo "Running certbot renew at $(date)..."

  # Attempt certificate renewal with error handling
  if certbot renew; then
    echo "certbot renewal succeeded at $(date)"

    # Find the nginx container ID
    NGINX_ID=$(docker ps -q -f "name=nginx" | head -1)

    if [ -n "$NGINX_ID" ]; then
      # Reload nginx configuration
      if docker exec "$NGINX_ID" nginx -s reload; then
        echo "nginx reloaded successfully at $(date)"
      else
        echo "ERROR: Failed to reload nginx" >&2
      fi
    else
      echo "WARNING: Could not find nginx container" >&2
    fi
  else
    echo "ERROR: certbot renewal FAILED at $(date)" >&2
    # Optionally, trigger an alert here (e.g., send email, webhook, etc.)
  fi

  echo "Next check in 12 hours..."
  echo "---"

  sleep 12h & wait ${!}
done
