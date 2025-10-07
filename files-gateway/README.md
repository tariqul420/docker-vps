# Files Gateway

Complete file storage and processing solution with MinIO S3, Imgproxy, and Filestash file manager.

## 🏗️ Services

- **MinIO** - S3-compatible object storage
- **Imgproxy** - On-the-fly image processing and optimization  
- **Filestash** - Web-based file manager and browser

## 🚀 Quick Start

### 1. Ensure Networks Exist
```bash
docker network create web
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Services
```bash
docker compose up -d
```

## 📋 Configuration

### Environment Variables (.env)
```bash
# MinIO S3 Storage
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your_strong_password

# Imgproxy Security
IMGPROXY_KEY=your_imgproxy_key
IMGPROXY_SALT=your_imgproxy_salt
```

### Generate Imgproxy Keys
```bash
# Generate random hex keys
echo $(xxd -g 2 -l 64 -p /dev/random | tr -d '\n')  # IMGPROXY_KEY
echo $(xxd -g 2 -l 64 -p /dev/random | tr -d '\n')  # IMGPROXY_SALT
```

## 🌐 Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| MinIO Console | https://minio.example.com | S3 storage management |
| S3 API | https://s3.example.com | S3 API endpoint |
| Image Proxy | https://img.example.com | Image processing |
| File Manager | https://files.example.com | Web file browser |

## 📚 Integration Examples

### Next.js/React Integration

#### 1. File Upload Hook
```typescript
// hooks/use-file-upload.ts
import { useState } from 'react';

interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (
    file: File,
    options?: {
      bucket?: string;
      folder?: string;
    }
  ): Promise<UploadResult> => {
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options?.bucket) {
        formData.append('bucket', options.bucket);
      }
      
      if (options?.folder) {
        formData.append('folder', options.folder);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      return {
        success: true,
        key: result.key,
        url: result.url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
}
```

#### 2. Upload API Route
```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT || 'https://s3.example.com',
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
    const bucket = formData.get('bucket') as string || 'uploads';
    const folder = formData.get('folder') as string || 'files';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const key = `${folder}/${fileName}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Return file info
    const url = `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/${bucket}/${key}`;

    return NextResponse.json({
      success: true,
      key,
      url,
      bucket,
      fileName,
      originalName: file.name,
      size: file.size,
      type: file.type,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

#### 3. Image Uploader Component
```typescript
// components/image-uploader.tsx
'use client';

import { useState, useRef } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getOptimizedImageUrl } from '@/lib/imgproxy';

interface ImageUploaderProps {
  onUpload?: (url: string, key: string) => void;
  currentImage?: string;
  bucket?: string;
  folder?: string;
}

export function ImageUploader({ 
  onUpload, 
  currentImage, 
  bucket = 'images',
  folder = 'uploads' 
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading } = useFileUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      const result = await upload(file, { bucket, folder });
      
      if (result.success && result.key && result.url) {
        onUpload?.(result.url, result.key);
      } else {
        alert(result.error || 'Upload failed');
        setPreview(currentImage || null);
      }
    } catch (error) {
      alert('Upload failed');
      setPreview(currentImage || null);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div 
        onClick={handleClick}
        className="relative w-64 h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
      >
        {preview ? (
          <img
            src={getOptimizedImageUrl(preview, { width: 256, height: 256 })}
            alt="Preview"
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-400 mb-2">
                📁
              </div>
              <p className="text-sm text-gray-500">
                Click to upload image
              </p>
            </div>
          </div>
        )}
        
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="text-white">Uploading...</div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
```

#### 4. Imgproxy Helper
```typescript
// lib/imgproxy.ts
import { createHmac } from 'crypto';

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  resize?: 'fit' | 'fill' | 'crop';
}

export function getOptimizedImageUrl(
  imageUrl: string, 
  options: ImageOptions = {}
): string {
  const {
    width = 800,
    height = 600,
    quality = 85,
    format = 'webp',
    resize = 'fit'
  } = options;

  const imgproxy_key = process.env.NEXT_PUBLIC_IMGPROXY_KEY;
  const imgproxy_salt = process.env.NEXT_PUBLIC_IMGPROXY_SALT;
  const imgproxy_url = process.env.NEXT_PUBLIC_IMGPROXY_BASE || 'https://img.example.com';

  if (!imgproxy_key || !imgproxy_salt) {
    return imageUrl; // Return original if no keys
  }

  // Build processing parameters
  const processing = [
    `rs:${resize}:${width}:${height}`,
    `q:${quality}`,
    `f:${format}`
  ].join('/');

  // Encode URL
  const encodedUrl = Buffer.from(imageUrl).toString('base64url');
  
  // Create path
  const path = `/${processing}/${encodedUrl}`;

  // Create signature
  const signature = createHmac('sha256', Buffer.from(imgproxy_key, 'hex'))
    .update(Buffer.from(imgproxy_salt, 'hex'))
    .update(path)
    .digest('base64url');

  return `${imgproxy_url}/${signature}${path}`;
}
```

#### 5. Environment Variables (.env.local)
```bash
# S3 Configuration
NEXT_PUBLIC_S3_ENDPOINT=https://s3.example.com
NEXT_PUBLIC_S3_BUCKET=uploads
S3_ACCESS_KEY=your_minio_access_key
S3_SECRET_KEY=your_minio_secret_key

# Imgproxy Configuration
NEXT_PUBLIC_IMGPROXY_BASE=https://img.example.com
NEXT_PUBLIC_IMGPROXY_KEY=your_imgproxy_key
NEXT_PUBLIC_IMGPROXY_SALT=your_imgproxy_salt
```

### Express.js Integration

#### File Upload Route
```javascript
// routes/upload.js
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'https://s3.example.com',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { bucket = 'uploads', folder = 'files' } = req.body;
    
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const key = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        originalName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    const url = `${process.env.S3_ENDPOINT}/${bucket}/${key}`;

    res.json({
      success: true,
      key,
      url,
      bucket,
      fileName,
      originalName: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
```

## 🔧 Advanced Configuration

### Custom Imgproxy Settings
```yaml
# docker-compose.yaml - imgproxy service
environment:
  # Security
  IMGPROXY_KEY: ${IMGPROXY_KEY}
  IMGPROXY_SALT: ${IMGPROXY_SALT}
  
  # Performance
  IMGPROXY_MAX_SRC_RESOLUTION: "100"  # 100MP max
  IMGPROXY_MAX_ANIMATION_FRAMES: "1"  # Disable GIF animation
  IMGPROXY_QUALITY: "85"              # Default quality
  
  # Formats
  IMGPROXY_AUTO_WEBP: "true"
  IMGPROXY_AUTO_AVIF: "true"
  
  # S3 Integration
  IMGPROXY_USE_S3: "true"
  IMGPROXY_S3_REGION: "us-east-1"
  IMGPROXY_S3_ENDPOINT: "http://minio:9000"
  IMGPROXY_S3_USE_PATH_STYLE: "true"
```

### MinIO Bucket Policies
```bash
# Create public read bucket
mc anonymous set public minio/public-images

# Create private bucket with specific access
mc admin policy create minio readonly-policy /path/to/readonly-policy.json
```

## 🛡️ Security

### Production Considerations
1. Use strong credentials
2. Enable MinIO versioning and lifecycle policies
3. Configure proper CORS policies
4. Use signed URLs for private content
5. Set up bucket notifications for audit logs

### MinIO Security
```bash
# Set bucket versioning
mc version enable minio/important-bucket

# Set lifecycle policy
mc lifecycle set --expiry-days 30 minio/temp-bucket
```

## 🔍 Troubleshooting

### Check Service Health
```bash
docker compose ps
docker compose logs -f minio
docker compose logs -f imgproxy
```

### MinIO Client Commands
```bash
# Install MinIO client
curl https://dl.min.io/client/mc/release/linux-amd64/mc -o mc
chmod +x mc

# Configure client
mc alias set minio https://s3.example.com admin your_password

# List buckets
mc ls minio

# Create bucket
mc mb minio/new-bucket
```

### Common Issues
1. **CORS errors**: Configure MinIO CORS policy
2. **Upload fails**: Check S3 credentials and bucket permissions
3. **Images not loading**: Verify Imgproxy key/salt configuration
4. **Network errors**: Ensure services are on same Docker network