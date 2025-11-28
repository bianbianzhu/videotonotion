import ytdlpBase from 'yt-dlp-exec';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { sanitizeFilename } from '../utils/urlUtils.js';

// Use system-installed yt-dlp binary
// @ts-ignore
const ytdlp = ytdlpBase.create('/opt/homebrew/bin/yt-dlp');

/** Video metadata fetched from a URL */
export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  filesize?: number;
  format?: string;
}

/** Result of a video download operation */
export interface DownloadResult {
  filePath: string;
  title: string;
  duration: number;
  filesize: number;
}

const TEMP_DIR = path.join(os.tmpdir(), 'videotonotion');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Fetches video metadata without downloading the video.
 * @param url - The video URL to fetch info from
 * @returns Video metadata including title, duration, and thumbnail
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const info = await ytdlp(url, {
    dumpSingleJson: true,
    noPlaylist: true,
    noWarnings: true,
  });

  return {
    title: info.title || 'Untitled Video',
    duration: info.duration || 0,
    thumbnail: info.thumbnail || '',
    filesize: info.filesize_approx || info.filesize,
    format: info.format,
  };
}

/**
 * Downloads a video to temporary storage.
 * @param url - The video URL to download
 * @param sessionId - Unique session identifier for organizing downloads
 * @param onProgress - Optional callback for download progress updates
 * @returns Download result with file path and metadata
 */
export async function downloadVideo(
  url: string,
  sessionId: string,
  onProgress?: (percent: number) => void
): Promise<DownloadResult> {
  const info = await getVideoInfo(url);
  const safeTitle = sanitizeFilename(info.title);
  const outputPath = path.join(TEMP_DIR, sessionId, `${safeTitle}.mp4`);

  // Create session directory
  const sessionDir = path.join(TEMP_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  await ytdlp(url, {
    output: outputPath,
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    mergeOutputFormat: 'mp4',
    noPlaylist: true,
    noWarnings: true,
  });

  const stats = fs.statSync(outputPath);

  return {
    filePath: outputPath,
    title: info.title,
    duration: info.duration,
    filesize: stats.size,
  };
}

/**
 * Removes the session directory and all downloaded files.
 * @param sessionId - Session to clean up
 */
export function cleanupSession(sessionId: string): void {
  const sessionDir = path.join(TEMP_DIR, sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export function getSessionDir(sessionId: string): string {
  return path.join(TEMP_DIR, sessionId);
}

/**
 * Extracts a frame from a video at a specific timestamp using ffmpeg.
 * @param videoPath - Path to the video file
 * @param timestamp - Timestamp in seconds
 * @returns Base64-encoded JPEG image
 */
export async function extractFrame(
  videoPath: string,
  timestamp: number
): Promise<string> {
  const { execSync } = await import('child_process');

  // Use ffmpeg to extract a frame at the specified timestamp
  // -ss before -i for fast seeking
  // -vframes 1 to extract only one frame
  // -f image2pipe to output to stdout
  // -vcodec mjpeg to output as JPEG
  const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -f image2pipe -vcodec mjpeg pipe:1 2>/dev/null`;

  try {
    const buffer = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 }); // 10MB max
    const base64 = buffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error: any) {
    throw new Error(`Failed to extract frame at ${timestamp}s: ${error.message}`);
  }
}
