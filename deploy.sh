#!/bin/bash

# Docker VPS Full Deployment Script
# This script deploys all services in the correct order

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-example.com}"
EMAIL="${EMAIL:-admin@example.com}"

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Docker VPS Deployment Script  ${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Generate random keys
generate_keys() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif command -v xxd &> /dev/null; then
        xxd -g 2 -l 64 -p /dev/random | tr -d '\n'
    else
        # Fallback to date-based random
        date +%s | sha256sum | head -c 64
    fi
}

# Create networks
create_networks() {
    print_info "Creating Docker networks..."
    
    networks=("proxy" "web" "appnet")
    
    for network in "${networks[@]}"; do
        if docker network ls | grep -q "$network"; then
            print_warning "Network '$network' already exists"
        else
            docker network create "$network"
            print_status "Created network '$network'"
        fi
    done
}

# Setup Traefik
setup_traefik() {
    print_info "Setting up Traefik..."
    
    cd traefik
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Update environment variables
        sed -i "s/admin@example.com/$EMAIL/g" .env
        sed -i "s/DOMAIN=example.com/DOMAIN=$DOMAIN/g" .env
        
        # Generate secure password hash
        if command -v htpasswd &> /dev/null; then
            # Generate random password if not provided
            DASHBOARD_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
            DASHBOARD_AUTH=$(htpasswd -nb admin "$DASHBOARD_PASSWORD")
            
            # Update .env with generated auth
            echo "TRAEFIK_DASHBOARD_AUTH=$DASHBOARD_AUTH" >> .env
            
            print_status "Created Traefik .env file with generated password: $DASHBOARD_PASSWORD"
            print_warning "Save this password: $DASHBOARD_PASSWORD"
        else
            print_warning "htpasswd not found. Using default password 'secret'"
            echo "TRAEFIK_DASHBOARD_AUTH=admin:\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi" >> .env
        fi
    fi
    
    # Ensure acme.json has correct permissions
    chmod 600 acme.json
    
    docker compose up -d
    print_status "Traefik is running"
    
    cd ..
}

# Setup Files Gateway
setup_files_gateway() {
    print_info "Setting up Files Gateway..."
    
    cd files-gateway
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Generate keys
        IMGPROXY_KEY=$(generate_keys)
        IMGPROXY_SALT=$(generate_keys)
        
        sed -i "s/generate_64_char_hex_key/$IMGPROXY_KEY/g" .env
        sed -i "s/generate_64_char_hex_key/$IMGPROXY_SALT/g" .env
        sed -i "s/change_this_strong_password/$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)/g" .env
        
        print_status "Created Files Gateway .env file with generated keys"
    fi
    
    # Update domain in docker-compose.yaml
    sed -i "s/example.com/$DOMAIN/g" docker-compose.yaml
    
    docker compose up -d
    print_status "Files Gateway is running"
    
    cd ..
}

# Setup Database
setup_database() {
    local db_type="${1:-postgres}"
    
    print_info "Setting up $db_type database..."
    
    cd "$db_type"
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Generate strong password
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        
        if [ "$db_type" = "postgres" ]; then
            sed -i "s/strong_password/$DB_PASSWORD/g" .env
        elif [ "$db_type" = "mongodb" ]; then
            sed -i "s/strong_password/$DB_PASSWORD/g" .env
        fi
        
        print_status "Created $db_type .env file with generated password"
        print_warning "Database password: $DB_PASSWORD"
    fi
    
    # Update domain in docker-compose.yaml
    sed -i "s/example.com/$DOMAIN/g" docker-compose.yaml
    
    docker compose up -d
    print_status "$db_type database is running"
    
    cd ..
}

# Setup Express API
setup_express_api() {
    print_info "Setting up Express API..."
    
    cd express-server
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Generate keys
        JWT_SECRET=$(openssl rand -base64 32)
        
        sed -i "s/your_jwt_secret_key_here/$JWT_SECRET/g" .env
        sed -i "s/change_this_password/$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)/g" .env
        sed -i "s/example.com/$DOMAIN/g" .env
        
        print_status "Created Express API .env file"
    fi
    
    # Update domain in docker-compose.yaml
    sed -i "s/example.com/$DOMAIN/g" docker-compose.yaml
    
    # Build and start
    docker compose up -d --build
    print_status "Express API is running"
    
    cd ..
}

# Setup Next.js App
setup_nextjs_app() {
    print_info "Setting up Next.js App..."
    
    cd nextjs/with_prisma
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Update domains and generate keys
        sed -i "s/example.com/$DOMAIN/g" .env
        
        print_status "Created Next.js .env file"
        print_warning "Please configure your environment variables in nextjs/with_prisma/.env"
    fi
    
    # Update domain in docker-compose.yaml
    sed -i "s/example.com/$DOMAIN/g" docker-compose.yaml
    
    # Build and start
    docker compose up -d --build
    print_status "Next.js app is running"
    
    cd ../..
}

# Wait for services
wait_for_services() {
    print_info "Waiting for services to be healthy..."
    
    # Wait a bit for services to start
    sleep 10
    
    # Check Traefik dashboard
    if curl -f http://localhost:8080 >/dev/null 2>&1; then
        print_status "Traefik dashboard is accessible"
    else
        print_warning "Traefik dashboard may not be ready yet"
    fi
}

# Display access information
show_access_info() {
    print_header
    echo -e "${GREEN}🎉 Deployment Complete! 🎉${NC}"
    echo ""
    echo "Your services are now running at:"
    echo ""
    echo "📊 Management Interfaces:"
    echo "  • Traefik Dashboard: https://traefik.$DOMAIN (admin/secret)"
    echo "  • MinIO Console: https://minio.$DOMAIN"
    echo "  • PostgreSQL GUI: https://pg.$DOMAIN"
    echo "  • MongoDB GUI: https://mongo.$DOMAIN"
    echo ""
    echo "🌐 Public Services:"
    echo "  • Next.js App: https://app.$DOMAIN"
    echo "  • Express API: https://api.$DOMAIN"
    echo "  • File Manager: https://files.$DOMAIN"
    echo ""
    echo "🔧 API Endpoints:"
    echo "  • S3 Storage: https://s3.$DOMAIN"
    echo "  • Image Proxy: https://img.$DOMAIN"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Point your domain DNS records to this server"
    echo "  2. Wait for SSL certificates to be issued"
    echo "  3. Configure your applications' environment variables"
    echo "  4. Check service logs: docker compose logs -f [service-name]"
    echo ""
    echo "🔐 Security Notes:"
    echo "  • Change default passwords before production use"
    echo "  • Configure firewall to allow only ports 80, 443"
    echo "  • Review and update environment variables"
    echo ""
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Deployment failed. Check the logs above."
        exit 1
    fi
}

# Main deployment function
main() {
    trap cleanup EXIT
    
    print_header
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --postgres-only)
                POSTGRES_ONLY=true
                shift
                ;;
            --mongodb-only)
                MONGODB_ONLY=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--domain DOMAIN] [--email EMAIL] [--postgres-only] [--mongodb-only]"
                echo ""
                echo "Options:"
                echo "  --domain DOMAIN     Set the base domain (default: example.com)"
                echo "  --email EMAIL       Set the email for SSL certificates (default: admin@example.com)"
                echo "  --postgres-only     Deploy only PostgreSQL database"
                echo "  --mongodb-only      Deploy only MongoDB database"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_info "Deploying with domain: $DOMAIN"
    print_info "SSL certificates email: $EMAIL"
    echo ""
    
    # Run deployment steps
    check_prerequisites
    create_networks
    setup_traefik
    setup_files_gateway
    
    # Setup databases based on options
    if [ "$POSTGRES_ONLY" = true ]; then
        setup_database "postgres"
    elif [ "$MONGODB_ONLY" = true ]; then
        setup_database "mongodb"
    else
        setup_database "postgres"
        setup_database "mongodb"
    fi
    
    setup_express_api
    setup_nextjs_app
    wait_for_services
    show_access_info
}

# Run main function
main "$@"