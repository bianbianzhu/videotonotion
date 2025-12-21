import { NoteSegment, ChunkContext, GcsUploadProgress, NoteLanguage } from '../types';
import { VERTEX_DEFAULT_MODEL, VERTEX_DEFAULT_LOCATION } from '../constants';

const API_BASE = '/api/ai';

export const generateNotesFromVideoVertex = async (
  projectId: string,
  location: string,
  base64Data: string,
  mimeType: string,
  model?: string,
  chunkContext?: ChunkContext,
  language: NoteLanguage = 'en'
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
      language,
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
 * Helper function to upload file to GCS with progress tracking
 */
async function uploadToGcsWithProgress(
  url: string,
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<{ gcsUri: string; sessionId: string }> {
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
          reject(new Error(error.error || 'GCS upload failed'));
        } catch {
          reject(new Error(`GCS upload failed: ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during GCS upload')));
    xhr.addEventListener('abort', () => reject(new Error('GCS upload aborted')));

    xhr.open('POST', url);
    xhr.send(formData);
  });
}

/**
 * Generate notes from video using Vertex AI with GCS bucket.
 * Uploads video to Google Cloud Storage, then analyzes via Vertex AI.
 *
 * NOTE: Files API does NOT work with Vertex AI. Use this GCS-based approach instead.
 */
export const generateNotesFromVideoVertexGcs = async (
  projectId: string,
  location: string,
  file: File | Blob,
  mimeType: string,
  bucketName: string,
  model?: string,
  onProgress?: (progress: GcsUploadProgress) => void,
  videoDuration?: number,
  language: NoteLanguage = 'en'
): Promise<NoteSegment[]> => {
  // Phase 1: Upload file to GCS via backend
  // bucketName is optional - server uses GCS_BUCKET_NAME env var as fallback
  onProgress?.({ phase: 'uploading', uploadProgress: 0 });

  const formData = new FormData();
  formData.append('video', file);
  if (bucketName) {
    formData.append('bucketName', bucketName);
  }
  formData.append('projectId', projectId || '');
  formData.append('location', location || VERTEX_DEFAULT_LOCATION);
  formData.append('model', model || VERTEX_DEFAULT_MODEL);
  formData.append('language', language);
  if (videoDuration !== undefined) {
    formData.append('videoDuration', videoDuration.toString());
  }

  const uploadResponse = await uploadToGcsWithProgress(
    `${API_BASE}/vertex/gcs/upload`,
    formData,
    (progress) => onProgress?.({ phase: 'uploading', uploadProgress: progress })
  );

  const { gcsUri, sessionId } = uploadResponse;

  onProgress?.({
    phase: 'ready',
    gcsUri,
    bucketName,
  });

  // Phase 2: Trigger analysis with GCS URI
  const response = await fetch(`${API_BASE}/vertex/gcs/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      gcsUri,
      projectId,
      location: location || VERTEX_DEFAULT_LOCATION,
      model: model || VERTEX_DEFAULT_MODEL,
      mimeType,
      videoDuration,
      language,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Vertex AI GCS analysis failed');
  }

  const result = await response.json();

  // Phase 3: Cleanup GCS file (best effort, don't fail if this errors)
  try {
    await fetch(`${API_BASE}/vertex/gcs/${sessionId}`, { method: 'DELETE' });
  } catch {
    console.warn('Failed to cleanup GCS file, it will be auto-cleaned later');
  }

  return result.segments as NoteSegment[];
};
