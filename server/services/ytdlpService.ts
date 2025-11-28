import ytdlp from 'yt-dlp-exec';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { sanitizeFilename } from '../utils/urlUtils.js';

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  filesize?: number;
  format?: string;
}

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

export function cleanupSession(sessionId: string): void {
  const sessionDir = path.join(TEMP_DIR, sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export function getSessionDir(sessionId: string): string {
  return path.join(TEMP_DIR, sessionId);
}
