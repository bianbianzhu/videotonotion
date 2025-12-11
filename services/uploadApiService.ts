const API_BASE = '/api/upload';

export interface ChunkInfo {
  id: string;
  startTime: number;
  endTime: number;
}

export interface UploadResult {
  sessionId: string;
  title: string;
  duration: number;
  chunks: ChunkInfo[];
}

/**
 * Upload a video file to the server for chunking.
 * @param file - The video file to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload result with session ID and chunks
 */
export async function uploadVideoForChunking(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('video', file);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || 'Upload failed'));
        } catch (e) {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', API_BASE);
    xhr.send(formData);
  });
}

/**
 * Fetch a specific chunk from an uploaded video session.
 * @param sessionId - The upload session ID
 * @param chunkId - The chunk ID
 * @returns Blob of the video chunk
 */
export async function fetchUploadedChunk(sessionId: string, chunkId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/chunk/${sessionId}/${chunkId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch chunk');
  }

  return response.blob();
}

/**
 * Get the full video URL for an uploaded video session.
 * @param sessionId - The upload session ID
 * @returns URL to stream the full video
 */
export function getUploadedVideoUrl(sessionId: string): string {
  return `${API_BASE}/full/${sessionId}`;
}

/**
 * Extract a frame from an uploaded video at a specific timestamp.
 * @param sessionId - The upload session ID
 * @param timestamp - Timestamp in seconds
 * @returns Base64-encoded JPEG image as data URL
 */
export async function extractFrameFromUpload(
  sessionId: string,
  timestamp: number
): Promise<string> {
  const response = await fetch(
    `${API_BASE}/frame/${sessionId}?timestamp=${timestamp}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract frame');
  }

  const data = await response.json();
  return data.image;
}

/**
 * Cleanup an upload session and its files.
 * @param sessionId - The upload session ID
 */
export async function cleanupUploadSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/session/${sessionId}`, { method: 'DELETE' });
}
