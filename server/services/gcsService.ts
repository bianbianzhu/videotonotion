import { Storage } from '@google-cloud/storage';
import path from 'path';

/**
 * Google Cloud Storage service for Vertex AI video analysis.
 * Files API does NOT work with Vertex AI, so we use GCS as an alternative.
 */

// Initialize GCS client (uses Application Default Credentials)
const storage = new Storage();

/**
 * Upload a video file to Google Cloud Storage.
 * @param filePath - Local path to the video file
 * @param bucketName - GCS bucket name
 * @param destinationName - Object name/path in the bucket
 * @returns GCS URI in format gs://bucket/path
 */
export async function uploadToGcs(
  filePath: string,
  bucketName: string,
  destinationName: string
): Promise<string> {
  const bucket = storage.bucket(bucketName);

  await bucket.upload(filePath, {
    destination: destinationName,
    resumable: true,
    metadata: {
      contentType: getMimeTypeFromPath(filePath),
    },
  });

  return `gs://${bucketName}/${destinationName}`;
}

/**
 * Delete a file from Google Cloud Storage.
 * @param bucketName - GCS bucket name
 * @param objectName - Object name/path in the bucket
 */
export async function deleteFromGcs(
  bucketName: string,
  objectName: string
): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);

  try {
    await file.delete();
  } catch (error: any) {
    // Ignore 404 errors (file already deleted)
    if (error.code !== 404) {
      throw error;
    }
  }
}

/**
 * Check if a file exists in GCS.
 * @param bucketName - GCS bucket name
 * @param objectName - Object name/path in the bucket
 * @returns true if file exists
 */
export async function fileExistsInGcs(
  bucketName: string,
  objectName: string
): Promise<boolean> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Get MIME type from file path.
 */
function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.3gp': 'video/3gpp',
  };
  return mimeTypes[ext] || 'video/mp4';
}
