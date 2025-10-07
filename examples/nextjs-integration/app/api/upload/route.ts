import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Configure S3 client
const s3Client = new S3Client({
  endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Validate file type and size
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file type
  if (!ALL_ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { valid: true };
}

// Generate safe filename
function generateSafeFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);
  
  // Sanitize filename
  const safeName = nameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50); // Limit length

  const uniqueId = uuidv4().substring(0, 8);
  return `${safeName}_${uniqueId}${ext}`;
}

// Upload handler
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = (formData.get('bucket') as string) || process.env.NEXT_PUBLIC_S3_BUCKET || 'uploads';
    const folder = (formData.get('folder') as string) || 'files';

    // Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Generate filename and key
    const filename = generateSafeFilename(file.name);
    const key = `${folder}/${filename}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Check if file already exists (optional)
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      
      // File exists, generate new name
      const newFilename = generateSafeFilename(file.name);
      const newKey = `${folder}/${newFilename}`;
      
      // Upload with new key
      await uploadToS3(bucket, newKey, buffer, file, filename);
      
      return NextResponse.json({
        success: true,
        key: newKey,
        url: `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/${bucket}/${newKey}`,
        filename: newFilename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        bucket,
        folder,
      });
      
    } catch (error) {
      // File doesn't exist, proceed with original key
      await uploadToS3(bucket, key, buffer, file, filename);
      
      return NextResponse.json({
        success: true,
        key,
        url: `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/${bucket}/${key}`,
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        bucket,
        folder,
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    
    let errorMessage = 'Upload failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to upload to S3
async function uploadToS3(
  bucket: string, 
  key: string, 
  buffer: Buffer, 
  file: File,
  filename: string
) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    ContentLength: buffer.length,
    Metadata: {
      originalName: file.name,
      filename: filename,
      uploadedAt: new Date().toISOString(),
      size: file.size.toString(),
      type: file.type,
    },
    // Set cache control for better performance
    CacheControl: ALLOWED_IMAGE_TYPES.includes(file.type) 
      ? 'public, max-age=31536000' // 1 year for images
      : 'public, max-age=86400',   // 1 day for documents
  });

  await s3Client.send(command);
}

// Get upload information
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const bucket = url.searchParams.get('bucket') || process.env.NEXT_PUBLIC_S3_BUCKET || 'uploads';

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key parameter required' },
        { status: 400 }
      );
    }

    // Get object metadata
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const result = await s3Client.send(command);

    return NextResponse.json({
      success: true,
      key,
      bucket,
      size: result.ContentLength,
      type: result.ContentType,
      lastModified: result.LastModified,
      metadata: result.Metadata,
      url: `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/${bucket}/${key}`,
    });

  } catch (error) {
    console.error('Get file info error:', error);
    
    if (error instanceof Error && error.name === 'NotFound') {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to get file information' },
      { status: 500 }
    );
  }
}