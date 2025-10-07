# Next.js Applications

Production-ready Next.js deployment with Docker, Prisma, and Traefik integration.

## 📁 Project Structure

```
nextjs/
├── with_mongo/          # Next.js with MongoDB
├── with_prisma/         # Next.js with Prisma/PostgreSQL
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Choose Your Stack
- `with_prisma/` - Next.js + Prisma + PostgreSQL
- `with_mongo/` - Next.js + MongoDB (to be created)

### 2. Setup Your Application
```bash
cd with_prisma  # or with_mongo
cp .env.example .env
# Edit .env with your configuration
```

### 3. Ensure Networks Exist
```bash
docker network create proxy
docker network create appnet
```

### 4. Start Dependencies
```bash
# Start Traefik first (required)
cd ../traefik && docker compose up -d

# Start database (for Prisma setup)
cd ../postgres && docker compose up -d
```

### 5. Deploy Application
```bash
cd with_prisma
docker compose up -d
```

## 📋 with_prisma Configuration

### Environment Variables (.env)
```bash
# Next.js Configuration
NEXT_PUBLIC_SITE_URL=https://app.example.com
NODE_ENV=production
PORT=3004

# Database
DATABASE_URL=postgresql://admin:password@postgres:5432/myapp

# Authentication (if using Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
WEBHOOK_SECRET=whsec_...

# File Storage (if using S3/MinIO)
NEXT_PUBLIC_S3_ENDPOINT=https://s3.example.com
NEXT_PUBLIC_S3_BUCKET=uploads
S3_ACCESS_KEY=your_minio_access_key
S3_SECRET_KEY=your_minio_secret_key

# Image Processing (if using Imgproxy)
NEXT_PUBLIC_IMGPROXY_BASE=https://img.example.com
IMGPROXY_KEY=your_imgproxy_key
IMGPROXY_SALT=your_imgproxy_salt

# Analytics (optional)
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

### Next.js Configuration (next.config.js)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker standalone build
  output: 'standalone',
  
  // Image optimization
  images: {
    domains: ['s3.example.com', 'img.example.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
```

## 🔧 Docker Configuration

### Multi-stage Dockerfile
The included Dockerfile uses multi-stage builds for optimal production images:

1. **Builder stage**: Installs dependencies, generates Prisma client, builds Next.js
2. **Runtime stage**: Minimal runtime with only production dependencies

### Build Arguments
The Dockerfile accepts build-time environment variables for Next.js public variables.

### Health Checks
Built-in health checks ensure the application starts correctly and database migrations run.

## 📚 Integration Examples

### File Upload with S3/MinIO
```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${Date.now()}-${file.name}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));

    return NextResponse.json({
      success: true,
      url: `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/${process.env.NEXT_PUBLIC_S3_BUCKET}/${key}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

### Image Optimization with Imgproxy
```typescript
// lib/imgproxy.ts
import { createHmac } from 'crypto';

export function getOptimizedImageUrl(
  imageUrl: string,
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  const { width = 800, height = 600, quality = 85 } = options;
  
  const key = process.env.IMGPROXY_KEY;
  const salt = process.env.IMGPROXY_SALT;
  const baseUrl = process.env.NEXT_PUBLIC_IMGPROXY_BASE;

  if (!key || !salt || !baseUrl) {
    return imageUrl;
  }

  const encodedUrl = Buffer.from(imageUrl).toString('base64url');
  const path = `/rs:fit:${width}:${height}/q:${quality}/${encodedUrl}`;
  
  const signature = createHmac('sha256', Buffer.from(key, 'hex'))
    .update(Buffer.from(salt, 'hex'))
    .update(path)
    .digest('base64url');

  return `${baseUrl}/${signature}${path}`;
}
```

### Database with Prisma
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(posts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, userId } = await request.json();
    
    const post = await prisma.post.create({
      data: { title, content, userId },
      include: { user: true },
    });
    
    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
```

## 🛡️ Security

### Environment Variables
- Never commit `.env` files to version control
- Use strong, unique passwords for all services
- Rotate API keys regularly

### SSL/TLS
- Traefik automatically handles SSL certificates
- Force HTTPS redirects are configured
- Use secure headers in Next.js config

### Authentication
The setup supports various auth providers:
- Clerk (recommended for modern apps)
- NextAuth.js
- Custom JWT implementation

## 📊 Monitoring

### Logs
```bash
# View application logs
docker compose logs -f my-nextjs-app

# View all services
docker compose logs -f
```

### Health Checks
```bash
# Check service status
docker compose ps

# Test application health
curl -f https://app.example.com/api/health || echo "Health check failed"
```

### Performance Monitoring
Consider integrating:
- Vercel Analytics
- Google Analytics 4
- Custom metrics with Prometheus

## 🔧 Development

### Local Development
```bash
# Copy and edit environment
cp .env.example .env.local

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Database Management
```bash
# Run migrations in production
docker exec my-nextjs-app npx prisma migrate deploy

# View database in Prisma Studio
docker exec -it my-nextjs-app npx prisma studio
```

## 🚀 Deployment

### Build Process
1. Dependencies installed
2. Prisma client generated
3. Next.js built with standalone output
4. Production dependencies only
5. Health checks configured

### Scaling
```yaml
# docker-compose.yaml - Scale horizontally
services:
  my-nextjs-app:
    deploy:
      replicas: 3
```

### Updates
```bash
# Pull latest code
git pull

# Rebuild and deploy
docker compose build --no-cache
docker compose up -d
```

## 🔍 Troubleshooting

### Common Issues

1. **Build failures**
   - Check Node.js version compatibility
   - Verify all environment variables are set
   - Review build logs: `docker compose logs my-nextjs-app`

2. **Database connection errors**
   - Ensure PostgreSQL is running
   - Verify DATABASE_URL format
   - Check network connectivity

3. **SSL certificate issues**
   - Verify domain DNS points to server
   - Check Traefik logs: `docker compose -f ../traefik/docker-compose.yaml logs traefik`

4. **File upload failures**
   - Verify S3 credentials and endpoint
   - Check MinIO service status
   - Review CORS configuration

### Debug Commands
```bash
# Access container shell
docker exec -it my-nextjs-app sh

# Check environment variables
docker exec my-nextjs-app env | grep -E "(DATABASE|S3|IMGPROXY)"

# Test database connection
docker exec my-nextjs-app npx prisma db pull

# View file system
docker exec my-nextjs-app ls -la /app
```