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

export interface FileUploadHook {
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useFileUpload(): FileUploadHook {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    if (!file) {
      const errorMsg = 'No file provided';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.bucket) {
        formData.append('bucket', options.bucket);
      }
      
      if (options.folder) {
        formData.append('folder', options.folder);
      }

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      return new Promise((resolve) => {
        // Upload progress handler
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setProgress(percentComplete);
            options.onProgress?.(percentComplete);
          }
        });

        // Success handler
        xhr.addEventListener('load', () => {
          setIsUploading(false);
          setProgress(0);

          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              if (result.success) {
                resolve({
                  success: true,
                  url: result.url,
                  key: result.key,
                });
              } else {
                const errorMsg = result.error || 'Upload failed';
                setError(errorMsg);
                resolve({ success: false, error: errorMsg });
              }
            } catch (parseError) {
              const errorMsg = 'Invalid response format';
              setError(errorMsg);
              resolve({ success: false, error: errorMsg });
            }
          } else {
            let errorMsg = `Upload failed with status ${xhr.status}`;
            
            // Try to parse error response
            try {
              const errorResult = JSON.parse(xhr.responseText);
              if (errorResult.error) {
                errorMsg = errorResult.error;
              }
            } catch {
              // Use default error message
            }
            
            setError(errorMsg);
            resolve({ success: false, error: errorMsg });
          }
        });

        // Error handler
        xhr.addEventListener('error', () => {
          setIsUploading(false);
          setProgress(0);
          const errorMsg = 'Network error during upload';
          setError(errorMsg);
          resolve({ success: false, error: errorMsg });
        });

        // Timeout handler
        xhr.addEventListener('timeout', () => {
          setIsUploading(false);
          setProgress(0);
          const errorMsg = 'Upload timeout';
          setError(errorMsg);
          resolve({ success: false, error: errorMsg });
        });

        // Configure request
        xhr.timeout = 60000; // 60 second timeout
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    } catch (error) {
      setIsUploading(false);
      setProgress(0);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Batch upload function
  const uploadMultiple = useCallback(async (
    files: File[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await upload(file, {
        ...options,
        onProgress: (fileProgress) => {
          const totalProgress = ((i / files.length) * 100) + (fileProgress / files.length);
          options.onProgress?.(totalProgress);
        },
      });
      results.push(result);
      
      // Stop on first error if desired
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }, [upload]);

  return {
    upload,
    isUploading,
    progress,
    error,
    uploadMultiple,
  } as FileUploadHook & { uploadMultiple: (files: File[], options?: UploadOptions) => Promise<UploadResult[]> };
}