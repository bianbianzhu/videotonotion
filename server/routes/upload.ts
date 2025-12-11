import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { chunkVideo, getChunkPath } from '../services/chunkService.js';
import { extractFrame } from '../services/ytdlpService.js';

const router: Router = Router();

// Temp directory for uploads
const TEMP_DIR = path.join(os.tmpdir(), 'videotonotion');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = randomUUID();
    const sessionDir = path.join(TEMP_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    // Store sessionId in request for later use
    (req as any).uploadSessionId = sessionId;
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and preserve extension
    const ext = path.extname(file.originalname) || '.mp4';
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max upload
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

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

function cleanupSession(sessionId: string): void {
  const sessionDir = path.join(TEMP_DIR, sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

function getSessionDir(sessionId: string): string {
  return path.join(TEMP_DIR, sessionId);
}

// POST /api/upload - Upload and chunk video
router.post('/', upload.single('video'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const sessionId = (req as any).uploadSessionId;

    if (!file || !sessionId) {
      res.status(400).json({ error: 'No video file uploaded' });
      return;
    }

    const sessionDir = getSessionDir(sessionId);
    const filePath = file.path;
    const title = path.basename(file.originalname, path.extname(file.originalname));

    console.log(`Uploaded file: ${filePath} (${file.size} bytes)`);

    // Chunk the video if needed
    const chunkResult = await chunkVideo(filePath, sessionId, sessionDir);
    console.log(`Created ${chunkResult.chunks.length} chunks for session ${sessionId}`);

    // Store session info
    sessions.set(sessionId, {
      title,
      chunks: chunkResult.chunks.map((c) => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
      fullVideoPath: filePath,
      createdAt: new Date(),
    });

    res.json({
      sessionId,
      title,
      duration: chunkResult.totalDuration,
      chunks: chunkResult.chunks.map((c) => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    });
  } catch (error: any) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: error.message || 'Upload processing failed' });
  }
});

// GET /api/upload/chunk/:sessionId/:chunkId - Stream a specific chunk
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

// GET /api/upload/full/:sessionId - Stream the full video (for frame extraction)
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

// GET /api/upload/frame/:sessionId - Extract a frame at a specific timestamp
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

// DELETE /api/upload/session/:sessionId - Cleanup session
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
