# Traefik Reverse Proxy

Traefik v3 reverse proxy with automatic SSL certificates via Let's Encrypt.

## 🚀 Quick Start

### 1. Create Networks
```bash
docker network create proxy
docker network create web
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Traefik
```bash
docker compose up -d
```

## 📋 Configuration

### Environment Variables (.env)
```bash
# Let's Encrypt email for SSL certificates
LETSENCRYPT_EMAIL=admin@example.com
```

### Traefik Configuration (traefik.yaml)
- HTTP to HTTPS redirect
- Docker provider with automatic service discovery
- Let's Encrypt certificates with HTTP challenge
- Dashboard on port 8080

## 🌐 Usage

### Dashboard
Access Traefik dashboard at: http://localhost:8080

### Adding Services
Services automatically register with Traefik using Docker labels:

```yaml
services:
  my-app:
    image: my-app:latest
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=proxy"
      - "traefik.http.routers.my-app.rule=Host(`app.example.com`)"
      - "traefik.http.routers.my-app.entrypoints=websecure"
      - "traefik.http.routers.my-app.tls=true"
      - "traefik.http.routers.my-app.tls.certresolver=letsencrypt"
      - "traefik.http.services.my-app.loadbalancer.server.port=3000"
```

## 🔧 Advanced Configuration

### Middlewares
Add custom middlewares for authentication, rate limiting, etc:

```yaml
labels:
  - "traefik.http.middlewares.auth.basicauth.users=admin:$$2y$$10$$..."
  - "traefik.http.routers.my-app.middlewares=auth"
```

### Multiple Domains
Support multiple domains for one service:

```yaml
labels:
  - "traefik.http.routers.my-app.rule=Host(`example.com`) || Host(`www.example.com`)"
```

### www Redirect
Automatically redirect www to non-www:

```yaml
labels:
  # Main domain
  - "traefik.http.routers.app.rule=Host(`example.com`)"
  - "traefik.http.routers.app.entrypoints=websecure"
  - "traefik.http.routers.app.tls=true"
  - "traefik.http.routers.app.tls.certresolver=letsencrypt"
  
  # www redirect
  - "traefik.http.routers.app-www.rule=Host(`www.example.com`)"
  - "traefik.http.routers.app-www.entrypoints=websecure"
  - "traefik.http.routers.app-www.tls=true"
  - "traefik.http.routers.app-www.tls.certresolver=letsencrypt"
  - "traefik.http.routers.app-www.middlewares=www-redirect"
  - "traefik.http.middlewares.www-redirect.redirectregex.regex=^https?://www\\.example\\.com(.*)"
  - "traefik.http.middlewares.www-redirect.redirectregex.replacement=https://example.com$$1"
  - "traefik.http.middlewares.www-redirect.redirectregex.permanent=true"
```

## 🛡️ Security

### Firewall
Ensure only ports 80, 443, and optionally 8080 are open to the public.

### Dashboard Security  
For production, disable the insecure dashboard or add authentication:

```yaml
# traefik.yaml
api:
  dashboard: true
  # Remove this line in production:
  # insecure: true
```

### SSL Configuration
The setup uses HTTP challenge for Let's Encrypt. For wildcard certificates, use DNS challenge instead.

## 🔍 Troubleshooting

### Check Logs
```bash
docker compose logs -f traefik
```

### Debug Mode
Enable debug logging:
```yaml
# traefik.yaml
log:
  level: DEBUG
```

### Certificate Issues
- Ensure port 80 is accessible for HTTP challenge
- Check domain DNS points to your server
- Verify email in Let's Encrypt configuration

### Common Issues
1. **acme.json permissions**: Must be 600
   ```bash
   chmod 600 acme.json
   ```

2. **Network not found**: Create external networks first
   ```bash
   docker network create proxy
   docker network create web
   ```

3. **Service not found**: Ensure service uses same network as defined in labels