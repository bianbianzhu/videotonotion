import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { isYouTubeUrl } from '../utils/urlUtils.js';
import {
  getVideoInfo,
  downloadVideo,
  getSessionDir,
  cleanupSession,
  extractFrame,
} from '../services/ytdlpService.js';
import { chunkVideo, getChunkPath } from '../services/chunkService.js';

const router: Router = Router();

// Store active sessions (in production, use Redis or similar)
const sessions = new Map<
  string,
  {
    title: string;
    chunks: Array<{ id: string; startTime: number; endTime: number }>;
    fullVideoPath: string;
    createdAt: Date;
  }
>();

// Cleanup old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [sessionId, session] of sessions.entries()) {
    if (session.createdAt < oneHourAgo) {
      cleanupSession(sessionId);
      sessions.delete(sessionId);
    }
  }
}, 15 * 60 * 1000); // Check every 15 minutes

// GET /api/youtube/info - Get video metadata
router.get('/info', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;

    if (!url) {
      res.status(400).json({ error: 'URL parameter is required' });
      return;
    }

    if (!isYouTubeUrl(url)) {
      res.status(400).json({ error: 'Invalid YouTube URL' });
      return;
    }

    const info = await getVideoInfo(url);
    res.json(info);
  } catch (error: any) {
    console.error('Error getting video info:', error);
    res.status(500).json({ error: error.message || 'Failed to get video info' });
  }
});

// POST /api/youtube/download - Download and chunk video
router.post('/download', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    if (!isYouTubeUrl(url)) {
      res.status(400).json({ error: 'Invalid YouTube URL' });
      return;
    }

    const sessionId = randomUUID();
    const sessionDir = getSessionDir(sessionId);

    console.log(`Starting download for session ${sessionId}: ${url}`);

    // Download the video
    const downloadResult = await downloadVideo(url, sessionId);
    console.log(`Downloaded: ${downloadResult.filePath} (${downloadResult.filesize} bytes)`);

    // Chunk the video if needed
    const chunkResult = await chunkVideo(
      downloadResult.filePath,
      sessionId,
      sessionDir
    );
    console.log(`Created ${chunkResult.chunks.length} chunks`);

    // Store session info
    sessions.set(sessionId, {
      title: downloadResult.title,
      chunks: chunkResult.chunks.map((c) => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
      fullVideoPath: downloadResult.filePath,
      createdAt: new Date(),
    });

    res.json({
      sessionId,
      title: downloadResult.title,
      duration: chunkResult.totalDuration,
      chunks: chunkResult.chunks.map((c) => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    });
  } catch (error: any) {
    console.error('Error downloading video:', error);

    // Provide helpful error messages
    let errorMessage = error.message || 'Download failed';
    if (errorMessage.includes('Video unavailable')) {
      errorMessage = 'Video not available or is private';
    } else if (errorMessage.includes('Sign in to confirm your age')) {
      errorMessage = 'Video requires sign-in (age-restricted)';
    }

    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/youtube/chunk/:sessionId/:chunkId - Stream a specific chunk
router.get('/chunk/:sessionId/:chunkId', async (req: Request, res: Response) => {
  try {
    const { sessionId, chunkId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }

    const sessionDir = getSessionDir(sessionId);
    const chunkPath = await getChunkPath(sessionDir, chunkId);

    if (!chunkPath || !fs.existsSync(chunkPath)) {
      res.status(404).json({ error: 'Chunk not found' });
      return;
    }

    const stat = fs.statSync(chunkPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${chunkId}.mp4"`);

    const stream = fs.createReadStream(chunkPath);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Error streaming chunk:', error);
    res.status(500).json({ error: error.message || 'Failed to stream chunk' });
  }
});

// GET /api/youtube/full/:sessionId - Stream the full video (for frame extraction)
router.get('/full/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }

    if (!fs.existsSync(session.fullVideoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const stat = fs.statSync(session.fullVideoPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(session.fullVideoPath);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Error streaming full video:', error);
    res.status(500).json({ error: error.message || 'Failed to stream video' });
  }
});

// GET /api/youtube/frame/:sessionId - Extract a frame at a specific timestamp using ffmpeg
router.get('/frame/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const timestamp = parseFloat(req.query.timestamp as string);

    if (isNaN(timestamp) || timestamp < 0) {
      res.status(400).json({ error: 'Valid timestamp parameter is required' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }

    if (!fs.existsSync(session.fullVideoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const frameData = await extractFrame(session.fullVideoPath, timestamp);
    res.json({ image: frameData, timestamp });
  } catch (error: any) {
    console.error('Error extracting frame:', error);
    res.status(500).json({ error: error.message || 'Failed to extract frame' });
  }
});

// DELETE /api/youtube/session/:sessionId - Cleanup session
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    cleanupSession(sessionId);
    sessions.delete(sessionId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error cleaning up session:', error);
    res.status(500).json({ error: error.message || 'Cleanup failed' });
  }
});

export default router;
