# Docker VPS Setup

A complete Docker-based VPS setup with Traefik reverse proxy, databases, file storage, and application hosting.

## 🏗️ Architecture

This setup provides:
- **Traefik** - Reverse proxy with automatic SSL certificates
- **Files Gateway** - MinIO S3 storage + Imgproxy + Filestash file manager
- **MongoDB** - NoSQL database with Mongo Express GUI
- **PostgreSQL** - SQL database with Adminer GUI
- **Next.js** - Application hosting with Prisma support

## 🌐 Networks

The setup uses Docker external networks:
- `proxy` - For Traefik reverse proxy
- `web` - For files gateway services  
- `appnet` - For applications and databases

## 🚀 Quick Start

### Automated Deployment (Recommended)
```bash
# Deploy everything with your domain
./deploy.sh --domain yourdomain.com --email your@email.com

# Or deploy with defaults (example.com)
./deploy.sh
```

### Manual Setup
1. **Create Networks**
   ```bash
   ./setup.sh  # Creates networks and shows setup instructions
   ```

2. **Deploy Services**
   ```bash
   # Start Traefik (Required First)
   cd traefik && cp .env.example .env
   # Edit .env with your email
   docker compose up -d

   # Start Files Gateway
   cd ../files-gateway && cp .env.example .env
   # Generate Imgproxy keys (see README)
   docker compose up -d

   # Start Database
   cd ../postgres && cp .env.example .env
   docker compose up -d

   # Start Applications
   cd ../nextjs/with_prisma && cp .env.example .env
   docker compose up -d
   ```

## 📋 Services Overview

| Service | URL | Description |
|---------|-----|-------------|
| Traefik Dashboard | http://localhost:8080 | Reverse proxy dashboard |
| MinIO Console | https://minio.example.com | S3 storage management |
| S3 API | https://s3.example.com | S3 compatible API |
| Image Proxy | https://img.example.com | Image processing service |
| File Manager | https://files.example.com | Web-based file browser |
| Mongo Express | https://mongo.example.com | MongoDB GUI |
| Adminer | https://pg.example.com | PostgreSQL GUI |

## 🔧 Configuration

Each service has its own `.env.example` file. Copy to `.env` and configure:

```bash
# In each service directory
cp .env.example .env
```

See individual service README files for detailed configuration options.

## 📚 Documentation

- [Traefik Setup](./traefik/README.md)
- [Files Gateway](./files-gateway/README.md)
- [MongoDB Setup](./mongodb/README.md)
- [PostgreSQL Setup](./postgres/README.md)
- [Next.js Deployment](./nextjs/README.md)

## 🔗 Integration Examples

Complete integration examples available in `/examples/`:
- [Next.js Integration](./examples/nextjs-integration/README.md) - Complete file upload, image optimization
- [Express.js Server](./express-server/README.md) - API server with file handling
- [Files Gateway](./files-gateway/README.md) - S3 storage and image processing

### Key Features
- **File Upload**: Drag & drop, progress tracking, validation
- **Image Optimization**: Automatic WebP/AVIF conversion, resizing
- **S3 Storage**: MinIO-compatible object storage
- **Database Support**: PostgreSQL and MongoDB with GUIs
- **SSL Certificates**: Automated Let's Encrypt integration
- **Reverse Proxy**: Traefik with automatic service discovery

## 🛡️ Security Notes

- Always use strong passwords in production
- Configure firewall rules appropriately
- Review SSL certificate settings
- Use environment variables for secrets
- Regularly update Docker images

## 📞 Support

For issues and questions, check the individual service documentation or create an issue in the repository.