#!/bin/bash

# Generate Traefik Dashboard Password Script
# This script generates a secure password hash for Traefik dashboard authentication

echo "🔐 Traefik Dashboard Password Generator"
echo "======================================"

# Check if htpasswd is available
if ! command -v htpasswd &> /dev/null; then
    echo "⚠️  htpasswd not found. Installing..."
    
    # Install apache2-utils based on the OS
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y apache2-utils
    elif command -v yum &> /dev/null; then
        sudo yum install -y httpd-tools
    elif command -v pacman &> /dev/null; then
        sudo pacman -S apache-tools
    else
        echo "❌ Could not install htpasswd. Please install it manually:"
        echo "   - Ubuntu/Debian: sudo apt-get install apache2-utils"
        echo "   - CentOS/RHEL: sudo yum install httpd-tools"
        echo "   - Arch: sudo pacman -S apache-tools"
        exit 1
    fi
fi

# Get username (default: admin)
read -p "Enter username (default: admin): " username
username=${username:-admin}

# Get password
echo "Enter password for $username:"
read -s password

if [ -z "$password" ]; then
    echo "❌ Password cannot be empty"
    exit 1
fi

# Generate password hash
echo ""
echo "Generating password hash..."
hash=$(htpasswd -nb "$username" "$password")

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate password hash"
    exit 1
fi

# Display results
echo ""
echo "✅ Password hash generated successfully!"
echo ""
echo "📋 Add this line to your docker-compose.yaml:"
echo "   - \"traefik.http.middlewares.traefik-auth.basicauth.users=$hash\""
echo ""
echo "📋 Or add to your .env file:"
echo "   TRAEFIK_DASHBOARD_AUTH=$hash"
echo ""
echo "   Then use in docker-compose.yaml:"
echo "   - \"traefik.http.middlewares.traefik-auth.basicauth.users=\${TRAEFIK_DASHBOARD_AUTH}\""
echo ""
echo "🌐 Dashboard will be accessible at: https://traefik.yourdomain.com"
echo "📧 Login with: $username / [your password]"