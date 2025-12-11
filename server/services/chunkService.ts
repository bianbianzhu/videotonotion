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

// Chunk size is configurable via CHUNK_SIZE_MB env var (default: 15MB)
// Smaller chunks = fewer tokens per API request = less likely to hit rate limits
const MAX_CHUNK_SIZE_MB = parseInt(process.env.CHUNK_SIZE_MB || '15', 10);
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

  // Post-check and re-split oversized chunks (handles VBR encoding)
  console.log(`Initial chunking complete: ${chunks.length} chunks. Validating sizes...`);
  const validatedChunks = await validateAndResplitChunks(
    chunks,
    filePath,
    outputDir,
    MAX_CHUNK_SIZE_BYTES
  );

  // Re-index chunks sequentially after any re-splits
  const finalChunks = reindexChunks(validatedChunks, outputDir);
  console.log(`Final chunk count after validation: ${finalChunks.length}`);

  return {
    chunks: finalChunks,
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
 * Splits an oversized chunk in half, creating two new chunks.
 * Videos use Variable Bit Rate (VBR) encoding, so time-based chunking
 * can produce inconsistent file sizes. This function handles oversized chunks.
 * @param chunk - The oversized chunk to split
 * @param inputPath - Path to original source video
 * @param outputDir - Directory for output chunks
 * @returns Two new chunks covering the same time range
 */
async function splitChunkInHalf(
  chunk: ChunkInfo,
  inputPath: string,
  outputDir: string
): Promise<ChunkInfo[]> {
  const midTime = chunk.startTime + (chunk.duration / 2);
  const firstDuration = midTime - chunk.startTime;
  const secondDuration = chunk.endTime - midTime;

  // Generate unique IDs for sub-chunks
  const firstId = `${chunk.id}-a`;
  const secondId = `${chunk.id}-b`;
  const firstPath = path.join(outputDir, `${firstId}.mp4`);
  const secondPath = path.join(outputDir, `${secondId}.mp4`);

  console.log(`Re-splitting oversized chunk ${chunk.id} (${(fs.statSync(chunk.path).size / 1024 / 1024).toFixed(1)}MB) into two halves`);

  // Delete the oversized chunk file
  if (fs.existsSync(chunk.path)) {
    fs.unlinkSync(chunk.path);
  }

  // Create two new chunks from the original video
  await createChunk(inputPath, firstPath, chunk.startTime, firstDuration);
  await createChunk(inputPath, secondPath, midTime, secondDuration);

  return [
    {
      id: firstId,
      index: -1, // Will be re-indexed later
      path: firstPath,
      startTime: chunk.startTime,
      endTime: midTime,
      duration: firstDuration,
    },
    {
      id: secondId,
      index: -1, // Will be re-indexed later
      path: secondPath,
      startTime: midTime,
      endTime: chunk.endTime,
      duration: secondDuration,
    },
  ];
}

/**
 * Validates chunk sizes and recursively re-splits any that exceed the max size.
 * This handles VBR (Variable Bit Rate) videos where time-based chunking
 * produces inconsistent file sizes due to varying bitrates throughout the video.
 * @param chunks - Array of chunks to validate
 * @param inputPath - Path to original source video
 * @param outputDir - Directory for output chunks
 * @param maxSizeBytes - Maximum allowed chunk size in bytes
 * @returns Array of validated chunks, all within size limit
 */
async function validateAndResplitChunks(
  chunks: ChunkInfo[],
  inputPath: string,
  outputDir: string,
  maxSizeBytes: number
): Promise<ChunkInfo[]> {
  const validChunks: ChunkInfo[] = [];

  for (const chunk of chunks) {
    // Skip chunks that reference the original file (small videos)
    if (chunk.path === inputPath) {
      validChunks.push(chunk);
      continue;
    }

    const fileSize = fs.statSync(chunk.path).size;

    if (fileSize <= maxSizeBytes) {
      // Chunk is within limit
      validChunks.push(chunk);
    } else {
      // Chunk too large - split it in half and recurse
      const subChunks = await splitChunkInHalf(chunk, inputPath, outputDir);
      const validSubChunks = await validateAndResplitChunks(
        subChunks,
        inputPath,
        outputDir,
        maxSizeBytes
      );
      validChunks.push(...validSubChunks);
    }
  }

  return validChunks;
}

/**
 * Re-indexes chunks sequentially and renames files to match.
 * After recursive splitting, chunk IDs may be like "chunk-0-a-b".
 * This normalizes them back to "chunk-0", "chunk-1", etc.
 * @param chunks - Array of chunks to re-index
 * @param outputDir - Directory containing chunk files
 * @returns Array of chunks with sequential indices and renamed files
 */
function reindexChunks(chunks: ChunkInfo[], outputDir: string): ChunkInfo[] {
  // Sort by start time to ensure correct order
  const sorted = [...chunks].sort((a, b) => a.startTime - b.startTime);

  // Two-pass rename strategy to avoid collisions:
  // When chunk-1 splits into chunk-1-a and chunk-1-b, and chunk-2 exists,
  // renaming sequentially could delete chunk-2 before we process it.
  // Using temporary names ensures no conflicts.

  // Pass 1: Rename all to temporary names to avoid collisions
  const tempChunks = sorted.map((chunk, index) => {
    const tempId = `_tmp_chunk-${index}`;
    const tempPath = path.join(outputDir, `${tempId}.mp4`);

    if (chunk.path !== tempPath && fs.existsSync(chunk.path)) {
      fs.renameSync(chunk.path, tempPath);
    }

    return { ...chunk, tempPath: fs.existsSync(tempPath) ? tempPath : chunk.path };
  });

  // Pass 2: Rename from temporary to final sequential names
  return tempChunks.map((chunk, index) => {
    const newId = `chunk-${index}`;
    const newPath = path.join(outputDir, `${newId}.mp4`);
    const sourcePath = (chunk as ChunkInfo & { tempPath: string }).tempPath;

    if (sourcePath !== newPath && fs.existsSync(sourcePath)) {
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
      }
      fs.renameSync(sourcePath, newPath);
    }

    return {
      ...chunk,
      id: newId,
      index,
      path: fs.existsSync(newPath) ? newPath : sourcePath,
    };
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
