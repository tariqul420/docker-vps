#!/bin/bash

# Setup Traefik Environment Script
# This script generates password hash and sets up environment variables

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

echo "🔧 Traefik Environment Setup"
echo "============================"

# Check if we're in the traefik directory
if [ ! -f "traefik.yaml" ]; then
    print_error "Please run this script from the traefik directory"
    exit 1
fi

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_status "Created .env file from template"
    else
        print_error ".env.example file not found"
        exit 1
    fi
fi

# Source the .env file to get current values
source .env

# Get domain
if [ -z "$DOMAIN" ]; then
    read -p "Enter your domain (default: example.com): " input_domain
    DOMAIN=${input_domain:-example.com}
fi

# Get email
if [ -z "$LETSENCRYPT_EMAIL" ]; then
    read -p "Enter your email for SSL certificates: " LETSENCRYPT_EMAIL
fi

# Get dashboard username
if [ -z "$TRAEFIK_DASHBOARD_USER" ]; then
    read -p "Enter dashboard username (default: admin): " input_user
    TRAEFIK_DASHBOARD_USER=${input_user:-admin}
fi

# Get dashboard password
if [ -z "$TRAEFIK_DASHBOARD_PASSWORD" ]; then
    echo "Enter dashboard password:"
    read -s TRAEFIK_DASHBOARD_PASSWORD
    echo
fi

if [ -z "$TRAEFIK_DASHBOARD_PASSWORD" ]; then
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

# Generate password hash
print_status "Generating password hash..."
TRAEFIK_DASHBOARD_AUTH=$(htpasswd -nb "$TRAEFIK_DASHBOARD_USER" "$TRAEFIK_DASHBOARD_PASSWORD")

if [ $? -ne 0 ]; then
    print_error "Failed to generate password hash"
    exit 1
fi

# Update .env file
cat > .env << EOF
# Let's Encrypt email for SSL certificates
LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL

# Domain configuration
DOMAIN=$DOMAIN

# Traefik Dashboard Authentication
TRAEFIK_DASHBOARD_USER=$TRAEFIK_DASHBOARD_USER
TRAEFIK_DASHBOARD_PASSWORD=$TRAEFIK_DASHBOARD_PASSWORD

# Generated password hash (do not edit manually)
TRAEFIK_DASHBOARD_AUTH=$TRAEFIK_DASHBOARD_AUTH
EOF

print_status "Environment file updated successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "  Domain: $DOMAIN"
echo "  Email: $LETSENCRYPT_EMAIL"
echo "  Dashboard URL: https://traefik.$DOMAIN"
echo "  Username: $TRAEFIK_DASHBOARD_USER"
echo "  Password: [hidden]"
echo ""
echo "🚀 You can now run: docker compose up -d"