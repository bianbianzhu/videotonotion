import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  analyzeVideoWithVertex,
  uploadVideoToFilesApi,
  getFileStatus,
  analyzeWithFilesApi,
} from '../services/aiService.js';

const router: Router = Router();

// ============================================================================
// Files API Configuration
// ============================================================================

const TEMP_DIR = path.join(os.tmpdir(), 'videotonotion-files');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Multer storage for Files API uploads
const filesApiStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = randomUUID();
    const sessionDir = path.join(TEMP_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    (req as any).filesApiSessionId = sessionId;
    (req as any).filesApiSessionDir = sessionDir;
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video${ext}`);
  },
});

const filesApiUpload = multer({
  storage: filesApiStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit for Files API
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

// POST /api/ai/vertex/analyze - Analyze video with Vertex AI
router.post('/vertex/analyze', async (req: Request, res: Response) => {
  try {
    const { projectId, location, model, base64Data, mimeType, chunkContext } = req.body;

    if (!base64Data || !mimeType) {
      res.status(400).json({
        error: 'Missing required fields: base64Data, mimeType',
      });
      return;
    }

    const segments = await analyzeVideoWithVertex(
      projectId,
      location,
      model || 'gemini-3-pro-preview',
      base64Data,
      mimeType,
      chunkContext
    );

    res.json({ segments });
  } catch (error: any) {
    console.error('Vertex AI Error:', error);

    let errorMessage = error.message || 'Analysis failed';

    // Provide helpful error messages
    if (errorMessage.includes('Could not load the default credentials')) {
      errorMessage =
        'Vertex AI credentials not found. Run: gcloud auth application-default login';
    } else if (errorMessage.includes('Permission denied')) {
      errorMessage = 'Permission denied. Check your project ID and ensure Vertex AI API is enabled.';
    } else if (errorMessage.includes('quota')) {
      errorMessage = 'Quota exceeded. Try again later or check your Vertex AI quota.';
    }

    res.status(500).json({ error: errorMessage });
  }
});

// ============================================================================
// Files API Endpoints
// ============================================================================

// POST /api/ai/vertex/files/upload - Upload video for Files API processing
router.post('/vertex/files/upload', filesApiUpload.single('video'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const sessionId = (req as any).filesApiSessionId;
    const { projectId, location, model } = req.body;

    if (!file || !sessionId) {
      res.status(400).json({ error: 'No video file uploaded' });
      return;
    }

    const result = await uploadVideoToFilesApi(
      file.path,
      sessionId,
      projectId || '',
      location || 'global',
      model || 'gemini-3-pro-preview'
    );

    res.json(result);
  } catch (error: any) {
    console.error('Files API upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// GET /api/ai/vertex/files/status/:sessionId - Check file processing status
router.get('/vertex/files/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const status = await getFileStatus(sessionId);
    res.json(status);
  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message || 'Status check failed' });
  }
});

// POST /api/ai/vertex/files/analyze - Analyze uploaded file
router.post('/vertex/files/analyze', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }

    const segments = await analyzeWithFilesApi(sessionId);
    res.json({ segments });
  } catch (error: any) {
    console.error('Files API analysis error:', error);

    let errorMessage = error.message || 'Analysis failed';

    // Provide helpful error messages
    if (errorMessage.includes('Could not load the default credentials')) {
      errorMessage =
        'Vertex AI credentials not found. Run: gcloud auth application-default login';
    } else if (errorMessage.includes('Permission denied')) {
      errorMessage = 'Permission denied. Check your project ID and ensure Vertex AI API is enabled.';
    } else if (errorMessage.includes('quota')) {
      errorMessage = 'Quota exceeded. Try again later or check your Vertex AI quota.';
    }

    res.status(500).json({ error: errorMessage });
  }
});

export default router;
