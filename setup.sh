#!/bin/bash

# Docker VPS Setup Script
# This script creates the necessary Docker networks and provides setup instructions

set -e

echo "🚀 Docker VPS Setup"
echo "===================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Create Docker networks
echo ""
echo "📡 Creating Docker networks..."

networks=("proxy" "web" "appnet")

for network in "${networks[@]}"; do
    if docker network ls | grep -q "$network"; then
        print_warning "Network '$network' already exists"
    else
        docker network create "$network"
        print_status "Created network '$network'"
    fi
done

echo ""
echo "📋 Setup Instructions:"
echo "====================="

echo ""
echo "1. 🔧 Configure Traefik (Required first):"
echo "   cd traefik"
echo "   cp .env.example .env"
echo "   # Edit .env with your email"
echo "   docker compose up -d"

echo ""
echo "2. 📁 Setup Files Gateway (S3 + Image Processing):"
echo "   cd files-gateway"
echo "   cp .env.example .env"
echo "   # Edit .env with strong passwords and generate keys:"
echo "   # IMGPROXY_KEY: xxd -g 2 -l 64 -p /dev/random | tr -d '\\n'"
echo "   # IMGPROXY_SALT: xxd -g 2 -l 64 -p /dev/random | tr -d '\\n'"
echo "   docker compose up -d"

echo ""
echo "3. 🗄️ Setup Database (Choose one or both):"
echo "   # PostgreSQL:"
echo "   cd postgres"
echo "   cp .env.example .env"
echo "   # Edit .env with credentials"
echo "   docker compose up -d"
echo ""
echo "   # MongoDB:"
echo "   cd mongodb"
echo "   cp .env.example .env"
echo "   # Edit .env with credentials"
echo "   docker compose up -d"

echo ""
echo "4. 🌐 Deploy Applications:"
echo "   # Next.js App:"
echo "   cd nextjs/with_prisma"
echo "   cp .env.example .env"
echo "   # Edit .env with all configurations"
echo "   docker compose up -d"
echo ""
echo "   # Express API:"
echo "   cd express-server"
echo "   cp .env.example .env"
echo "   # Edit .env with configurations"
echo "   docker compose up -d"

echo ""
echo "📱 Access URLs (replace example.com with your domain):"
echo "======================================================="
echo "• Traefik Dashboard: http://localhost:8080"
echo "• MinIO Console: https://minio.example.com"
echo "• S3 API: https://s3.example.com"
echo "• Image Proxy: https://img.example.com"
echo "• File Manager: https://files.example.com"
echo "• MongoDB GUI: https://mongo.example.com"
echo "• PostgreSQL GUI: https://pg.example.com"
echo "• Next.js App: https://app.example.com"
echo "• Express API: https://api.example.com"

echo ""
echo "🔐 Security Notes:"
echo "=================="
echo "• Use strong, unique passwords for all services"
echo "• Generate random hex keys for Imgproxy"
echo "• Point your domains to this server's IP"
echo "• Configure firewall to allow only ports 80, 443"
echo "• Regularly update Docker images"

echo ""
echo "🎉 Setup complete! Networks created successfully."
echo "Follow the steps above to deploy your services."