# Next.js Files Gateway Integration Examples

Complete integration examples for using the files-gateway with Next.js/React applications.

## 📁 File Structure

```
examples/nextjs-integration/
├── components/
│   ├── image-uploader.tsx      # Image upload component
│   └── file-manager.tsx        # File management component
├── lib/
│   ├── imgproxy.ts            # Image optimization helper
│   ├── s3-client.ts           # S3 client configuration
│   └── file-upload.ts         # File upload utilities
├── hooks/
│   └── use-file-upload.ts     # File upload hook
├── app/api/
│   ├── upload/route.ts        # Upload API route
│   └── imgproxy/route.ts      # Imgproxy helper route
└── types/
    └── file.ts                # TypeScript types
```

## 🔧 Installation

```bash
npm install @aws-sdk/client-s3 @types/node
# or
yarn add @aws-sdk/client-s3 @types/node
```

## 📚 Usage Examples

### 1. Basic Image Upload Component

```typescript
// components/image-uploader.tsx
'use client';

import { useState } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getOptimizedImageUrl } from '@/lib/imgproxy';

interface ImageUploaderProps {
  onUpload?: (url: string) => void;
  currentImage?: string;
  className?: string;
}

export function ImageUploader({ onUpload, currentImage, className }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const { upload, isUploading, progress } = useFileUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      const result = await upload(file, {
        bucket: 'images',
        folder: 'uploads',
        onProgress: (percent) => console.log(\`Upload progress: \${percent}%\`),
      });

      if (result.success && result.url) {
        onUpload?.(result.url);
        // Clean up preview URL
        URL.revokeObjectURL(previewUrl);
      } else {
        alert(result.error || 'Upload failed');
        setPreview(currentImage || null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
      setPreview(currentImage || null);
    }
  };

  return (
    <div className={\`space-y-4 \${className}\`}>
      <div className="relative">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className="w-64 h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors">
          {preview ? (
            <img
              src={getOptimizedImageUrl(preview, { width: 256, height: 256 })}
              alt="Preview"
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm text-gray-500">Click to upload image</p>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="text-white text-center">
              <div className="mb-2">Uploading...</div>
              {progress > 0 && (
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: \`\${progress}%\` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 2. Advanced File Manager Component

```typescript
// components/file-manager.tsx
'use client';

import { useState, useEffect } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getOptimizedImageUrl } from '@/lib/imgproxy';
import { FileObject } from '@/types/file';

interface FileManagerProps {
  bucket?: string;
  folder?: string;
  maxFiles?: number;
  allowedTypes?: string[];
  onFilesChange?: (files: FileObject[]) => void;
}

export function FileManager({
  bucket = 'uploads',
  folder = 'files',
  maxFiles = 10,
  allowedTypes = ['image/*', 'application/pdf', 'text/*'],
  onFilesChange,
}: FileManagerProps) {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const { upload, isUploading } = useFileUpload();

  const handleFileSelect = async (selectedFiles: FileList) => {
    const fileArray = Array.from(selectedFiles);
    
    // Check file limits
    if (files.length + fileArray.length > maxFiles) {
      alert(\`Maximum \${maxFiles} files allowed\`);
      return;
    }

    // Upload files
    for (const file of fileArray) {
      try {
        const result = await upload(file, { bucket, folder });
        
        if (result.success) {
          const newFile: FileObject = {
            id: result.key?.split('/').pop()?.split('.')[0] || '',
            name: file.name,
            size: file.size,
            type: file.type,
            url: result.url || '',
            key: result.key || '',
            uploadedAt: new Date(),
          };
          
          setFiles(prev => {
            const updated = [...prev, newFile];
            onFilesChange?.(updated);
            return updated;
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
        alert(\`Failed to upload \${file.name}\`);
      }
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      onFilesChange?.(updated);
      return updated;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={\`border-2 border-dashed rounded-lg p-6 text-center transition-colors \${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
        }\`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <input
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className="space-y-2">
          <div className="text-4xl">📁</div>
          <p className="text-lg font-medium">
            {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
          </p>
          <p className="text-sm text-gray-500">
            Maximum {maxFiles} files • {formatFileSize(10 * 1024 * 1024)} per file
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Uploaded Files ({files.length})</h3>
          <div className="grid gap-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                {/* File Thumbnail */}
                <div className="w-12 h-12 flex-shrink-0">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={getOptimizedImageUrl(file.url, { width: 48, height: 48 })}
                      alt={file.name}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center text-xs">
                      {file.type.includes('pdf') ? '📄' : '📄'}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-grow min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)} • {file.uploadedAt.toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    View
                  </a>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. File Upload Hook

```typescript
// hooks/use-file-upload.ts
import { useState, useCallback } from 'react';

export interface UploadOptions {
  bucket?: string;
  folder?: string;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.bucket) {
        formData.append('bucket', options.bucket);
      }
      
      if (options.folder) {
        formData.append('folder', options.folder);
      }

      const xhr = new XMLHttpRequest();

      return new Promise((resolve) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setProgress(percentComplete);
            options.onProgress?.(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          setIsUploading(false);
          setProgress(0);

          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                url: result.url,
                key: result.key,
              });
            } catch (error) {
              resolve({ success: false, error: 'Invalid response format' });
            }
          } else {
            resolve({ success: false, error: \`Upload failed with status \${xhr.status}\` });
          }
        });

        xhr.addEventListener('error', () => {
          setIsUploading(false);
          setProgress(0);
          resolve({ success: false, error: 'Network error during upload' });
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    } catch (error) {
      setIsUploading(false);
      setProgress(0);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }, []);

  return { upload, isUploading, progress };
}
```

### 4. TypeScript Types

```typescript
// types/file.ts
export interface FileObject {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  key: string;
  uploadedAt: Date;
}

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  resize?: 'fit' | 'fill' | 'crop';
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}
```

## 🎯 Complete Usage Example

```typescript
// pages/upload-demo.tsx
'use client';

import { useState } from 'react';
import { ImageUploader } from '@/components/image-uploader';
import { FileManager } from '@/components/file-manager';
import { FileObject } from '@/types/file';

export default function UploadDemo() {
  const [profileImage, setProfileImage] = useState<string>('');
  const [documents, setDocuments] = useState<FileObject[]>([]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">File Upload Demo</h1>

      {/* Profile Image Upload */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Profile Image</h2>
        <ImageUploader
          currentImage={profileImage}
          onUpload={setProfileImage}
          className="max-w-sm"
        />
        {profileImage && (
          <p className="mt-2 text-sm text-gray-600">
            Image URL: {profileImage}
          </p>
        )}
      </section>

      {/* Document Upload */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Document Manager</h2>
        <FileManager
          bucket="documents"
          folder="user-uploads"
          maxFiles={5}
          allowedTypes={['application/pdf', 'image/*', 'text/*']}
          onFilesChange={setDocuments}
        />
      </section>

      {/* Upload Summary */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Upload Summary</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p>Profile Image: {profileImage ? '✅ Uploaded' : '❌ Not uploaded'}</p>
          <p>Documents: {documents.length} files uploaded</p>
        </div>
      </section>
    </div>
  );
}
```

## 🔧 Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_S3_ENDPOINT=https://s3.example.com
NEXT_PUBLIC_S3_BUCKET=uploads
S3_ACCESS_KEY=your_minio_access_key
S3_SECRET_KEY=your_minio_secret_key

NEXT_PUBLIC_IMGPROXY_BASE=https://img.example.com
IMGPROXY_KEY=your_64_char_hex_key
IMGPROXY_SALT=your_64_char_hex_salt
```

This integration provides a complete file upload and management solution for Next.js applications using the files-gateway infrastructure.