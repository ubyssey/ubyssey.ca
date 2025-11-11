#!/bin/bash

# Script to update search engine bot IP whitelists
# This script fetches CIDR blocks from various search engines and updates nginx configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_DIR="/etc/nginx"
WHITELIST_DIR="${NGINX_DIR}/bot-whitelist"
TEMP_DIR="/tmp/bot-whitelist-$$"

# Create directories
mkdir -p "${TEMP_DIR}"
mkdir -p "${WHITELIST_DIR}"

echo "Updating search engine bot whitelists..."

# Function to fetch and format Googlebot IPs
update_googlebot() {
    echo "Fetching Googlebot IP ranges..."
    local output_file="${WHITELIST_DIR}/googlebot.conf"
    local temp_file="${TEMP_DIR}/googlebot.conf"

    # Fetch the JSON file
    if curl -s -f "https://developers.google.com/search/apis/ipranges/googlebot.json" -o "${TEMP_DIR}/googlebot.json"; then
        # Parse JSON and create nginx geo configuration
        echo "# Googlebot IP ranges - Auto-generated on $(date)" > "${temp_file}"
        echo "# Source: https://developers.google.com/search/apis/ipranges/googlebot.json" >> "${temp_file}"
        echo "" >> "${temp_file}"

        # Extract IPv4 prefixes
        if command -v jq &> /dev/null; then
            jq -r '.prefixes[]?.ipv4Prefix // empty' "${TEMP_DIR}/googlebot.json" | while read -r cidr; do
                echo "${cidr} 1;" >> "${temp_file}"
            done

            # Extract IPv6 prefixes
            jq -r '.prefixes[]?.ipv6Prefix // empty' "${TEMP_DIR}/googlebot.json" | while read -r cidr; do
                echo "${cidr} 1;" >> "${temp_file}"
            done
        else
            # Fallback to grep/sed if jq is not available
            grep -o '"ipv4Prefix": "[^"]*"' "${TEMP_DIR}/googlebot.json" | sed 's/"ipv4Prefix": "//;s/"//;s/$/;/' | sed 's/^/    /' >> "${temp_file}"
            grep -o '"ipv6Prefix": "[^"]*"' "${TEMP_DIR}/googlebot.json" | sed 's/"ipv6Prefix": "//;s/"//;s/$/;/' | sed 's/^/    /' >> "${temp_file}"
        fi

        mv "${temp_file}" "${output_file}"
        echo "✓ Googlebot whitelist updated: ${output_file}"
    else
        echo "✗ Failed to fetch Googlebot IP ranges"
        return 1
    fi
}

# Function to fetch and format Bingbot IPs
update_bingbot() {
    echo "Fetching Bingbot IP ranges..."
    local output_file="${WHITELIST_DIR}/bingbot.conf"
    local temp_file="${TEMP_DIR}/bingbot.conf"

    # Bing publishes their IPs in a JSON format
    if curl -s -f "https://www.bing.com/toolbox/bingbot.json" -o "${TEMP_DIR}/bingbot.json"; then
        echo "# Bingbot IP ranges - Auto-generated on $(date)" > "${temp_file}"
        echo "# Source: https://www.bing.com/toolbox/bingbot.json" >> "${temp_file}"
        echo "" >> "${temp_file}"

        if command -v jq &> /dev/null; then
            jq -r '.prefixes[]?.ipv4Prefix // empty' "${TEMP_DIR}/bingbot.json" 2>/dev/null | while read -r cidr; do
                [ -n "$cidr" ] && echo "${cidr} 1;" >> "${temp_file}"
            done

            jq -r '.prefixes[]?.ipv6Prefix // empty' "${TEMP_DIR}/bingbot.json" 2>/dev/null | while read -r cidr; do
                [ -n "$cidr" ] && echo "${cidr} 1;" >> "${temp_file}"
            done
        fi

        if [ -s "${temp_file}" ] && [ $(wc -l < "${temp_file}") -gt 3 ]; then
            mv "${temp_file}" "${output_file}"
            echo "✓ Bingbot whitelist updated: ${output_file}"
        else
            echo "⚠ Bingbot whitelist appears empty, keeping old version if exists"
            rm -f "${temp_file}"
        fi
    else
        echo "⚠ Failed to fetch Bingbot IP ranges (this may be expected - Bing doesn't always publish IPs)"
    fi
}

# Main execution
update_googlebot
update_bingbot

# Cleanup
rm -rf "${TEMP_DIR}"

echo ""
echo "Whitelist update complete!"
echo "Files created in: ${WHITELIST_DIR}"
echo ""
echo "To apply changes, reload nginx:"
echo "  nginx -t && nginx -s reload"
echo ""
echo "Consider adding this script to cron for automatic updates:"
echo "  0 0 * * 0 ${SCRIPT_DIR}/update-bot-whitelist.sh && nginx -s reload"
