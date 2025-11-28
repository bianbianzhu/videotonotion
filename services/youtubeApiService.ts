const API_BASE = '/api/youtube';

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  filesize?: number;
}

export interface ChunkInfo {
  id: string;
  startTime: number;
  endTime: number;
}

export interface DownloadResult {
  sessionId: string;
  title: string;
  duration: number;
  chunks: ChunkInfo[];
}

export function isYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

export async function getYouTubeVideoInfo(url: string): Promise<VideoInfo> {
  const response = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get video info');
  }

  return response.json();
}

export async function startYouTubeDownload(url: string): Promise<DownloadResult> {
  const response = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Download failed');
  }

  return response.json();
}

export async function fetchChunk(sessionId: string, chunkId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/chunk/${sessionId}/${chunkId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch chunk');
  }

  return response.blob();
}

export function getFullVideoUrl(sessionId: string): string {
  return `${API_BASE}/full/${sessionId}`;
}

export async function cleanupSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/session/${sessionId}`, { method: 'DELETE' });
}

/**
 * Extract a frame from a video at a specific timestamp using server-side ffmpeg.
 * @param sessionId - The YouTube session ID
 * @param timestamp - Timestamp in seconds
 * @returns Base64-encoded JPEG image as data URL
 */
export async function extractFrameFromServer(
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
