#!/bin/bash

# Change Traefik Dashboard Password Script
# This script updates the dashboard password in an existing .env file

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo "🔐 Change Traefik Dashboard Password"
echo "===================================="

# Check if we're in the traefik directory
if [ ! -f "traefik.yaml" ]; then
    print_error "Please run this script from the traefik directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Run ./setup-env.sh first"
    exit 1
fi

# Source the .env file to get current values
source .env

echo "Current username: ${TRAEFIK_DASHBOARD_USER:-admin}"
echo ""

# Get new password
echo "Enter new password:"
read -s new_password
echo

if [ -z "$new_password" ]; then
    print_error "Password cannot be empty"
    exit 1
fi

# Check if htpasswd is available
if ! command -v htpasswd &> /dev/null; then
    print_warning "htpasswd not found. Installing..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y apache2-utils
    elif command -v yum &> /dev/null; then
        sudo yum install -y httpd-tools
    elif command -v pacman &> /dev/null; then
        sudo pacman -S apache-tools
    else
        print_error "Could not install htpasswd. Please install apache2-utils/httpd-tools"
        exit 1
    fi
fi

# Generate new password hash
print_status "Generating new password hash..."
username=${TRAEFIK_DASHBOARD_USER:-admin}
new_auth=$(htpasswd -nb "$username" "$new_password")

if [ $? -ne 0 ]; then
    print_error "Failed to generate password hash"
    exit 1
fi

# Update .env file
temp_file=$(mktemp)

# Update the password and auth lines in .env
while IFS= read -r line; do
    if [[ $line == TRAEFIK_DASHBOARD_PASSWORD=* ]]; then
        echo "TRAEFIK_DASHBOARD_PASSWORD=$new_password"
    elif [[ $line == TRAEFIK_DASHBOARD_AUTH=* ]]; then
        echo "TRAEFIK_DASHBOARD_AUTH=$new_auth"
    else
        echo "$line"
    fi
done < .env > "$temp_file"

mv "$temp_file" .env

print_status "Password updated successfully!"
echo ""
echo "📋 New Configuration:"
echo "  Username: $username"
echo "  Password: [updated]"
echo "  Dashboard URL: https://traefik.${DOMAIN:-example.com}"
echo ""
echo "🔄 Restart Traefik to apply changes:"
echo "  docker compose restart"