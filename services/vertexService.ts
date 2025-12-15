import { NoteSegment, ChunkContext, FilesApiUploadProgress } from '../types';
import { VERTEX_DEFAULT_MODEL, VERTEX_DEFAULT_LOCATION, FILES_API_POLL_INTERVAL_MS, FILES_API_TIMEOUT_MS } from '../constants';

const API_BASE = '/api/ai';

export const generateNotesFromVideoVertex = async (
  projectId: string,
  location: string,
  base64Data: string,
  mimeType: string,
  model?: string,
  chunkContext?: ChunkContext
): Promise<NoteSegment[]> => {
  const response = await fetch(`${API_BASE}/vertex/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      location: location || VERTEX_DEFAULT_LOCATION,
      model: model || VERTEX_DEFAULT_MODEL,
      base64Data,
      mimeType,
      chunkContext,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Vertex AI analysis failed');
  }

  const result = await response.json();
  return result.segments as NoteSegment[];
};

/**
 * Helper function to upload file with progress tracking
 */
async function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<{ fileName: string; sessionId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', url);
    xhr.send(formData);
  });
}

/**
 * Poll backend for file processing status
 */
async function pollFileStatus(sessionId: string): Promise<{ state: string; uri?: string }> {
  const response = await fetch(`${API_BASE}/vertex/files/status/${sessionId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get file status');
  }
  return response.json();
}

/**
 * Generate notes from video using Vertex AI Files API via backend.
 * Uploads entire video (up to 2GB) without chunking.
 */
export const generateNotesFromVideoVertexFilesApi = async (
  projectId: string,
  location: string,
  file: File | Blob,
  mimeType: string,
  model?: string,
  onProgress?: (progress: FilesApiUploadProgress) => void
): Promise<NoteSegment[]> => {
  // Phase 1: Upload file to backend
  onProgress?.({ phase: 'uploading', uploadProgress: 0 });

  const formData = new FormData();
  formData.append('video', file);
  formData.append('projectId', projectId || '');
  formData.append('location', location || VERTEX_DEFAULT_LOCATION);
  formData.append('model', model || VERTEX_DEFAULT_MODEL);

  const uploadResponse = await uploadWithProgress(
    `${API_BASE}/vertex/files/upload`,
    formData,
    (progress) => onProgress?.({ phase: 'uploading', uploadProgress: progress })
  );

  const { fileName, sessionId } = uploadResponse;

  onProgress?.({
    phase: 'processing',
    fileName,
    processingStartTime: Date.now(),
  });

  // Phase 2: Poll backend for file status
  const startTime = Date.now();
  let status = await pollFileStatus(sessionId);

  while (status.state !== 'ACTIVE') {
    if (Date.now() - startTime > FILES_API_TIMEOUT_MS) {
      throw new Error(`File processing timeout after ${FILES_API_TIMEOUT_MS / 1000}s. Try using Inline strategy.`);
    }

    if (status.state === 'FAILED') {
      throw new Error('File processing failed on Vertex AI servers. Try using Inline strategy.');
    }

    await new Promise(r => setTimeout(r, FILES_API_POLL_INTERVAL_MS));
    status = await pollFileStatus(sessionId);
  }

  onProgress?.({
    phase: 'ready',
    fileName,
    fileUri: status.uri,
  });

  // Phase 3: Trigger analysis
  const response = await fetch(`${API_BASE}/vertex/files/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Vertex AI Files API analysis failed');
  }

  const result = await response.json();
  return result.segments as NoteSegment[];
};
