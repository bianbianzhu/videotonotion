import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export interface ChunkInfo {
  id: string;
  index: number;
  path: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ChunkResult {
  chunks: ChunkInfo[];
  totalDuration: number;
}

const MAX_CHUNK_SIZE_MB = 18;
const MAX_CHUNK_SIZE_BYTES = MAX_CHUNK_SIZE_MB * 1024 * 1024;

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

export async function getChunkPath(
  sessionDir: string,
  chunkId: string
): Promise<string | null> {
  const chunkPath = path.join(sessionDir, `${chunkId}.mp4`);

  // Check if it's the original file (chunk-0 for small videos)
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

  if (fs.existsSync(chunkPath)) {
    return chunkPath;
  }

  return null;
}
