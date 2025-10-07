import { createHmac } from 'crypto';

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png' | 'auto';
  resize?: 'fit' | 'fill' | 'crop';
  gravity?: 'center' | 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';
  blur?: number;
  sharpen?: number;
}

/**
 * Generate an optimized image URL using Imgproxy
 * @param imageUrl - The source image URL
 * @param options - Image processing options
 * @returns Optimized image URL or original URL if Imgproxy is not configured
 */
export function getOptimizedImageUrl(
  imageUrl: string,
  options: ImageOptions = {}
): string {
  // Return original URL if no image provided
  if (!imageUrl) return imageUrl;

  const imgproxyKey = process.env.NEXT_PUBLIC_IMGPROXY_KEY || process.env.IMGPROXY_KEY;
  const imgproxySalt = process.env.NEXT_PUBLIC_IMGPROXY_SALT || process.env.IMGPROXY_SALT;
  const imgproxyUrl = process.env.NEXT_PUBLIC_IMGPROXY_BASE || process.env.IMGPROXY_BASE_URL;

  // Return original URL if Imgproxy is not configured
  if (!imgproxyKey || !imgproxySalt || !imgproxyUrl) {
    console.warn('Imgproxy not configured, returning original URL');
    return imageUrl;
  }

  const {
    width = 800,
    height = 600,
    quality = 85,
    format = 'auto',
    resize = 'fit',
    gravity = 'center',
    blur,
    sharpen
  } = options;

  // Build processing parameters
  const processingParams: string[] = [];

  // Resize
  processingParams.push(`rs:${resize}:${width}:${height}:0`);

  // Gravity (for crop mode)
  if (resize === 'crop') {
    processingParams.push(`g:${gravity}`);
  }

  // Quality
  processingParams.push(`q:${quality}`);

  // Format
  if (format !== 'auto') {
    processingParams.push(`f:${format}`);
  }

  // Blur
  if (blur && blur > 0) {
    processingParams.push(`bl:${blur}`);
  }

  // Sharpen
  if (sharpen && sharpen > 0) {
    processingParams.push(`sh:${sharpen}`);
  }

  const processing = processingParams.join('/');

  // Encode the source URL
  let encodedUrl: string;
  try {
    // Handle both full URLs and relative paths
    if (imageUrl.startsWith('http')) {
      encodedUrl = Buffer.from(imageUrl).toString('base64url');
    } else {
      // For relative URLs, prepend the S3 endpoint if available
      const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT;
      const fullUrl = s3Endpoint && !imageUrl.startsWith('/') 
        ? `${s3Endpoint}/${imageUrl}`
        : imageUrl;
      encodedUrl = Buffer.from(fullUrl).toString('base64url');
    }
  } catch (error) {
    console.error('Failed to encode image URL:', error);
    return imageUrl;
  }

  // Create the path
  const path = `/${processing}/${encodedUrl}`;

  // Generate signature
  let signature: string;
  try {
    signature = createHmac('sha256', Buffer.from(imgproxyKey, 'hex'))
      .update(Buffer.from(imgproxySalt, 'hex'))
      .update(path)
      .digest('base64url');
  } catch (error) {
    console.error('Failed to generate Imgproxy signature:', error);
    return imageUrl;
  }

  return `${imgproxyUrl}/${signature}${path}`;
}

/**
 * Generate multiple image sizes for responsive images
 */
export function generateResponsiveImageUrls(
  imageUrl: string,
  sizes: Array<{ width: number; height?: number; suffix?: string }>
): Record<string, string> {
  const urls: Record<string, string> = {};
  
  sizes.forEach(({ width, height, suffix }) => {
    const key = suffix || `${width}w`;
    urls[key] = getOptimizedImageUrl(imageUrl, {
      width,
      height: height || Math.round(width * 0.75), // Default 4:3 aspect ratio
      format: 'webp',
    });
  });

  return urls;
}

/**
 * Generate srcSet string for responsive images
 */
export function generateSrcSet(
  imageUrl: string,
  widths: number[] = [320, 640, 960, 1280, 1920]
): string {
  return widths
    .map(width => {
      const url = getOptimizedImageUrl(imageUrl, {
        width,
        height: Math.round(width * 0.75),
        format: 'webp',
      });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Get thumbnail URL for images
 */
export function getThumbnailUrl(
  imageUrl: string,
  size: number = 150
): string {
  return getOptimizedImageUrl(imageUrl, {
    width: size,
    height: size,
    resize: 'crop',
    gravity: 'center',
    format: 'webp',
    quality: 80,
  });
}

/**
 * Get avatar URL with circular crop
 */
export function getAvatarUrl(
  imageUrl: string,
  size: number = 100
): string {
  return getOptimizedImageUrl(imageUrl, {
    width: size,
    height: size,
    resize: 'crop',
    gravity: 'center',
    format: 'webp',
    quality: 90,
  });
}

/**
 * Validate if URL is a supported image format
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|avif|bmp|tiff)$/i;
  const imageMimeTypes = /^image\//;
  
  // Check file extension
  if (imageExtensions.test(url)) {
    return true;
  }
  
  // Check if it's a data URL with image mime type
  if (url.startsWith('data:') && imageMimeTypes.test(url)) {
    return true;
  }
  
  // For S3 URLs without extensions, assume they might be images
  const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT;
  if (s3Endpoint && url.startsWith(s3Endpoint)) {
    return true;
  }
  
  return false;
}

/**
 * Extract image metadata from URL (if available)
 */
export function extractImageMetadata(url: string): {
  isImage: boolean;
  extension?: string;
  isS3Url: boolean;
} {
  const isImage = isImageUrl(url);
  const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT;
  const isS3Url = s3Endpoint ? url.startsWith(s3Endpoint) : false;
  
  let extension: string | undefined;
  const extensionMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (extensionMatch) {
    extension = extensionMatch[1].toLowerCase();
  }
  
  return {
    isImage,
    extension,
    isS3Url,
  };
}