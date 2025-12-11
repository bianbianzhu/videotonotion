import path from 'path';
import fs from 'fs';

// Images directory path - must match db/index.ts
const DATA_DIR = path.join(process.cwd(), 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

/**
 * Save a base64 image to the filesystem.
 * @param sessionId - The session ID
 * @param noteIndex - The note index (0-based)
 * @param base64Data - Base64 data URL (data:image/jpeg;base64,...)
 * @returns Relative path to the saved image
 */
export function saveImage(sessionId: string, noteIndex: number, base64Data: string): string {
  const sessionDir = path.join(IMAGES_DIR, sessionId);

  // Ensure session directory exists
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Strip data URL prefix if present
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  const filename = `note-${noteIndex}.jpg`;
  const filePath = path.join(sessionDir, filename);
  fs.writeFileSync(filePath, buffer);

  // Return relative path for database storage
  return `${sessionId}/${filename}`;
}

/**
 * Delete all images for a session.
 * @param sessionId - The session ID
 */
export function deleteSessionImages(sessionId: string): void {
  const sessionDir = path.join(IMAGES_DIR, sessionId);

  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
}

/**
 * Get the absolute path to an image file.
 * @param relativePath - Relative path from database (e.g., "sessionId/note-0.jpg")
 * @returns Absolute path to the image file
 */
export function getImageAbsolutePath(relativePath: string): string {
  return path.join(IMAGES_DIR, relativePath);
}

/**
 * Check if an image exists.
 * @param relativePath - Relative path from database
 * @returns True if the image exists
 */
export function imageExists(relativePath: string): boolean {
  const absPath = getImageAbsolutePath(relativePath);
  return fs.existsSync(absPath);
}

/**
 * Read an image file and return as base64 data URL.
 * @param relativePath - Relative path from database
 * @returns Base64 data URL or null if not found
 */
export function getImageAsDataUrl(relativePath: string): string | null {
  const absPath = getImageAbsolutePath(relativePath);

  if (!fs.existsSync(absPath)) {
    return null;
  }

  const buffer = fs.readFileSync(absPath);
  const base64 = buffer.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}
