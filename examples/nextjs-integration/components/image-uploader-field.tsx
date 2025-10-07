'use client';

import { useState, useRef } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getOptimizedImageUrl } from '@/lib/imgproxy';

interface ImageUploaderFieldProps {
  value?: string;
  onChange?: (url: string, key: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  className?: string;
  bucket?: string;
  folder?: string;
  maxSize?: number; // in MB
  accept?: string;
  disabled?: boolean;
}

export function ImageUploaderField({
  value,
  onChange,
  onError,
  placeholder = "Click to upload image",
  className = "",
  bucket = "images",
  folder = "uploads",
  maxSize = 10,
  accept = "image/*",
  disabled = false,
}: ImageUploaderFieldProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, progress } = useFileUpload();

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file';
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `File size must be less than ${maxSize}MB`;
    }

    return null;
  };

  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      onError?.(validationError);
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      const result = await upload(file, { bucket, folder });

      if (result.success && result.url && result.key) {
        onChange?.(result.url, result.key);
        // Clean up preview URL
        URL.revokeObjectURL(previewUrl);
        setPreview(result.url);
      } else {
        onError?.(result.error || 'Upload failed');
        setPreview(value || null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError?.('Upload failed');
      setPreview(value || null);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    if (disabled || isUploading) return;

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const removeImage = (event: React.MouseEvent) => {
    event.stopPropagation();
    setPreview(null);
    onChange?.('', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !isUploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={`
          relative w-full h-64 border-2 border-dashed rounded-lg 
          transition-all duration-200 overflow-hidden
          ${dragOver && !disabled && !isUploading
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled
            ? 'cursor-not-allowed opacity-50'
            : isUploading
            ? 'cursor-wait'
            : 'cursor-pointer'
          }
        `}
      >
        {preview ? (
          <>
            <img
              src={getOptimizedImageUrl(preview, { width: 400, height: 300 })}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            
            {/* Remove button */}
            {!disabled && !isUploading && (
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full 
                         flex items-center justify-center hover:bg-red-600 transition-colors
                         shadow-lg"
                title="Remove image"
              >
                ×
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="text-4xl mb-4 text-gray-400">
              📷
            </div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {placeholder}
            </p>
            <p className="text-sm text-gray-500 mb-1">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-gray-400">
              Max size: {maxSize}MB • Formats: JPG, PNG, GIF, WebP
            </p>
          </div>
        )}

        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
            <div className="text-white text-center space-y-3">
              <div className="text-lg font-medium">Uploading...</div>
              
              {/* Progress bar */}
              <div className="w-48 bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="text-sm">
                {Math.round(progress)}%
              </div>
            </div>
          </div>
        )}

        {/* Drag overlay */}
        {dragOver && !disabled && !isUploading && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center">
            <div className="text-blue-600 text-xl font-medium">
              Drop image here
            </div>
          </div>
        )}
      </div>

      {/* File info */}
      {preview && !isUploading && (
        <div className="mt-2 text-xs text-gray-500">
          <p className="truncate">Image uploaded successfully</p>
        </div>
      )}
    </div>
  );
}