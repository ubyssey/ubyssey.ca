#!/bin/sh

# Certbot service with automatic nginx reload
# This script runs continuously, checking for certificate renewals every 12 hours.
# Uses --deploy-hook to reload nginx only when certificates are actually renewed.

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

  # Attempt certificate renewal with --deploy-hook
  # The hook only runs when a certificate is actually renewed
  if certbot renew --deploy-hook "
    echo 'Certificate renewed, reloading nginx...'
    NGINX_ID=\$(docker ps -q -f 'name=nginx' | head -1)
    if [ -n \"\$NGINX_ID\" ]; then
      if docker exec \"\$NGINX_ID\" nginx -s reload; then
        echo 'nginx reloaded successfully at \$(date)'
      else
        echo 'ERROR: Failed to reload nginx' >&2
      fi
    else
      echo 'WARNING: Could not find nginx container' >&2
    fi
  "; then
    echo "certbot renewal check completed at $(date)"
  else
    echo "ERROR: certbot renewal FAILED at $(date)" >&2
  fi

  echo "Next check in 12 hours..."
  echo "---"

  sleep 12h & wait ${!}
done
