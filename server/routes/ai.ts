import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { analyzeVideoVertexInline, analyzeVideoVertexGcs } from '../services/aiService.js';
import { uploadToGcs, deleteFromGcs } from '../services/gcsService.js';

const router: Router = Router();

// ============================================================================
// GCS Configuration (replaces Files API which doesn't work with Vertex AI)
// ============================================================================

const TEMP_DIR = path.join(os.tmpdir(), 'videotonotion-gcs');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Session storage for GCS uploads
interface GcsSession {
  gcsUri: string;
  bucketName: string;
  objectName: string;
  localPath: string;
  projectId: string;
  location: string;
  model: string;
  mimeType: string;
  videoDuration?: number;
  createdAt: Date;
}

const gcsSessions = new Map<string, GcsSession>();

// Cleanup old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [sessionId, session] of gcsSessions.entries()) {
    if (session.createdAt < oneHourAgo) {
      // Cleanup local file
      if (fs.existsSync(session.localPath)) {
        fs.unlinkSync(session.localPath);
      }
      // Try to cleanup GCS file (best effort)
      deleteFromGcs(session.bucketName, session.objectName).catch(() => {});
      gcsSessions.delete(sessionId);
    }
  }
}, 15 * 60 * 1000); // Check every 15 minutes

// Multer storage for GCS uploads
const gcsStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const sessionId = randomUUID();
    const sessionDir = path.join(TEMP_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    (req as any).gcsSessionId = sessionId;
    (req as any).gcsSessionDir = sessionDir;
    cb(null, sessionDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video${ext}`);
  },
});

const gcsUpload = multer({
  storage: gcsStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit (GCS has no practical limit)
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

/**
 * Get MIME type from file path
 */
function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.3gp': 'video/3gpp',
  };
  return mimeTypes[ext] || 'video/mp4';
}

// POST /api/ai/vertex/analyze - Analyze video with Vertex AI (inline base64)
router.post('/vertex/analyze', async (req: Request, res: Response) => {
  try {
    const { projectId, location, model, base64Data, mimeType, chunkContext } = req.body;

    if (!base64Data || !mimeType) {
      res.status(400).json({
        error: 'Missing required fields: base64Data, mimeType',
      });
      return;
    }

    const segments = await analyzeVideoVertexInline(
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
// GCS Endpoints (for Vertex AI large video analysis)
// NOTE: Files API does NOT work with Vertex AI. Use GCS instead.
// ============================================================================

// POST /api/ai/vertex/gcs/upload - Upload video to GCS for Vertex AI analysis
router.post('/vertex/gcs/upload', gcsUpload.single('video'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const sessionId = (req as any).gcsSessionId;
    const { bucketName: requestBucketName, projectId, location, model, videoDuration } = req.body;
    // Use env var as fallback if no bucket name provided
    const bucketName = requestBucketName || process.env.GCS_BUCKET_NAME;

    if (!file || !sessionId) {
      res.status(400).json({ error: 'No video file uploaded' });
      return;
    }

    if (!bucketName) {
      res.status(400).json({ error: 'GCS bucket name is required. Set GCS_BUCKET_NAME in server/.env or provide it in the request.' });
      return;
    }

    // Generate unique object name in GCS
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.mp4';
    const objectName = `videotonotion/${sessionId}/${timestamp}${ext}`;
    const mimeType = getMimeTypeFromPath(file.path);

    console.log(`Uploading to GCS: gs://${bucketName}/${objectName}`);

    // Upload to GCS
    const gcsUri = await uploadToGcs(file.path, bucketName, objectName);

    // Store session for later analysis
    gcsSessions.set(sessionId, {
      gcsUri,
      bucketName,
      objectName,
      localPath: file.path,
      projectId: projectId || '',
      location: location || 'us-central1',
      model: model || 'gemini-3-pro-preview',
      mimeType,
      videoDuration: videoDuration ? parseFloat(videoDuration) : undefined,
      createdAt: new Date(),
    });

    console.log(`GCS upload complete: ${gcsUri}`);

    res.json({ gcsUri, sessionId });
  } catch (error: any) {
    console.error('GCS upload error:', error);

    let errorMessage = error.message || 'Upload failed';

    // Provide helpful error messages
    if (errorMessage.includes('Could not load the default credentials')) {
      errorMessage = 'GCS credentials not found. Run: gcloud auth application-default login';
    } else if (errorMessage.includes('does not have storage.objects.create')) {
      errorMessage = 'Permission denied. Ensure your account has storage.objectCreator role on the bucket.';
    } else if (errorMessage.includes('The specified bucket does not exist')) {
      errorMessage = 'GCS bucket not found. Check the bucket name and ensure it exists.';
    }

    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/ai/vertex/gcs/analyze - Analyze video from GCS URI
router.post('/vertex/gcs/analyze', async (req: Request, res: Response) => {
  try {
    const { sessionId, gcsUri, projectId, location, model, mimeType, videoDuration } = req.body;

    let analysisGcsUri = gcsUri;
    let analysisMimeType = mimeType || 'video/mp4';
    let analysisProjectId = projectId;
    let analysisLocation = location;
    let analysisModel = model;
    let analysisVideoDuration = videoDuration ? parseFloat(videoDuration) : undefined;
    let session: GcsSession | undefined;

    // If sessionId provided, use stored session info
    if (sessionId) {
      session = gcsSessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      analysisGcsUri = session.gcsUri;
      analysisMimeType = session.mimeType;
      analysisProjectId = session.projectId || projectId;
      analysisLocation = session.location || location;
      analysisModel = session.model || model;
      analysisVideoDuration = session.videoDuration ?? analysisVideoDuration;
    }

    if (!analysisGcsUri) {
      res.status(400).json({ error: 'GCS URI or session ID required' });
      return;
    }

    console.log(`Analyzing video from GCS: ${analysisGcsUri}`);

    // Build video metadata if duration is available
    const videoMetadata = analysisVideoDuration
      ? { totalDuration: analysisVideoDuration }
      : undefined;

    const segments = await analyzeVideoVertexGcs(
      analysisProjectId || '',
      analysisLocation || 'us-central1',
      analysisModel || 'gemini-3-pro-preview',
      analysisGcsUri,
      analysisMimeType,
      videoMetadata
    );

    res.json({ segments });
  } catch (error: any) {
    console.error('GCS analysis error:', error);

    let errorMessage = error.message || 'Analysis failed';

    // Provide helpful error messages
    if (errorMessage.includes('Could not load the default credentials')) {
      errorMessage = 'Vertex AI credentials not found. Run: gcloud auth application-default login';
    } else if (errorMessage.includes('Permission denied')) {
      errorMessage = 'Permission denied. Check your project ID and ensure Vertex AI API is enabled.';
    } else if (errorMessage.includes('quota')) {
      errorMessage = 'Quota exceeded. Try again later or check your Vertex AI quota.';
    } else if (errorMessage.includes('INVALID_ARGUMENT') && errorMessage.includes('gs://')) {
      errorMessage = 'Cannot access GCS file. Ensure the file exists and Vertex AI has permission to read it.';
    }

    res.status(500).json({ error: errorMessage });
  }
});

// DELETE /api/ai/vertex/gcs/:sessionId - Cleanup GCS file and session
router.delete('/vertex/gcs/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = gcsSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Delete from GCS
    try {
      await deleteFromGcs(session.bucketName, session.objectName);
      console.log(`Deleted from GCS: gs://${session.bucketName}/${session.objectName}`);
    } catch (e) {
      console.warn('Failed to delete from GCS:', e);
    }

    // Delete local file
    if (fs.existsSync(session.localPath)) {
      fs.unlinkSync(session.localPath);
    }

    // Remove session
    gcsSessions.delete(sessionId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('GCS cleanup error:', error);
    res.status(500).json({ error: error.message || 'Cleanup failed' });
  }
});

export default router;
