import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/** Information about a single video chunk */
export interface ChunkInfo {
  id: string;
  index: number;
  path: string;
  startTime: number;
  endTime: number;
  duration: number;
}

/** Result of chunking a video file */
export interface ChunkResult {
  chunks: ChunkInfo[];
  totalDuration: number;
}

// Chunk size is configurable via CHUNK_SIZE_MB env var (default: 10MB)
// Smaller chunks = fewer tokens per API request = less likely to hit rate limits
const MAX_CHUNK_SIZE_MB = parseInt(process.env.CHUNK_SIZE_MB || '10', 10);
const MAX_CHUNK_SIZE_BYTES = MAX_CHUNK_SIZE_MB * 1024 * 1024;

/**
 * Gets the duration of a video file using ffprobe.
 * @param filePath - Path to the video file
 * @returns Duration in seconds
 */
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Gets the bitrate of a video file using ffprobe.
 * @param filePath - Path to the video file
 * @returns Bitrate in bits per second
 */
function getVideoBitrate(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      // Bitrate in bits per second
      const bitrate = metadata.format.bit_rate || 2000000; // Default 2 Mbps
      resolve(bitrate);
    });
  });
}

/**
 * Splits a video file into smaller chunks for API upload limits.
 * @param filePath - Path to the source video file
 * @param sessionId - Unique session identifier
 * @param outputDir - Directory to write chunks to
 * @returns Chunk metadata and total duration
 */
export async function chunkVideo(
  filePath: string,
  sessionId: string,
  outputDir: string
): Promise<ChunkResult> {
  const fileSize = fs.statSync(filePath).size;
  const duration = await getVideoDuration(filePath);
  const bitrate = await getVideoBitrate(filePath);

  // If file is small enough, no chunking needed
  if (fileSize <= MAX_CHUNK_SIZE_BYTES) {
    return {
      chunks: [
        {
          id: 'chunk-0',
          index: 0,
          path: filePath,
          startTime: 0,
          endTime: duration,
          duration: duration,
        },
      ],
      totalDuration: duration,
    };
  }

  // Calculate chunk duration based on bitrate
  // chunk_size = bitrate * duration => duration = chunk_size / bitrate
  const bytesPerSecond = bitrate / 8;
  const chunkDurationSeconds = Math.floor(MAX_CHUNK_SIZE_BYTES / bytesPerSecond);
  const numChunks = Math.ceil(duration / chunkDurationSeconds);

  const chunks: ChunkInfo[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDurationSeconds;
    const endTime = Math.min((i + 1) * chunkDurationSeconds, duration);
    const chunkId = `chunk-${i}`;
    const chunkPath = path.join(outputDir, `${chunkId}.mp4`);

    await createChunk(filePath, chunkPath, startTime, endTime - startTime);

    chunks.push({
      id: chunkId,
      index: i,
      path: chunkPath,
      startTime,
      endTime,
      duration: endTime - startTime,
    });
  }

  return {
    chunks,
    totalDuration: duration,
  };
}

/**
 * Creates a single video chunk using ffmpeg.
 * @param inputPath - Path to source video
 * @param outputPath - Path to write chunk
 * @param startTime - Start time in seconds
 * @param duration - Chunk duration in seconds
 */
function createChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Resolves the file path for a given chunk ID.
 * @param sessionDir - Session directory path
 * @param chunkId - Chunk identifier
 * @returns Chunk file path or null if not found
 */
export async function getChunkPath(
  sessionDir: string,
  chunkId: string
): Promise<string | null> {
  const chunkPath = path.join(sessionDir, `${chunkId}.mp4`);

  // First: check if actual chunk file exists
  if (fs.existsSync(chunkPath)) {
    return chunkPath;
  }

  // Fallback for small videos where no chunking was performed:
  // chunk-0 maps to the original file
  if (chunkId === 'chunk-0') {
    const files = fs.readdirSync(sessionDir);
    const mp4File = files.find(f => f.endsWith('.mp4') && !f.startsWith('chunk-'));
    if (mp4File) {
      const originalPath = path.join(sessionDir, mp4File);
      if (fs.existsSync(originalPath)) {
        return originalPath;
      }
    }
  }

  return null;
}
