import { Router, Request, Response } from 'express';
import { analyzeVideoWithVertex } from '../services/aiService.js';

const router: Router = Router();

// POST /api/ai/vertex/analyze - Analyze video with Vertex AI
router.post('/vertex/analyze', async (req: Request, res: Response) => {
  try {
    const { projectId, location, model, base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      res.status(400).json({
        error: 'Missing required fields: base64Data, mimeType',
      });
      return;
    }

    const segments = await analyzeVideoWithVertex(
      projectId,
      location,
      model || 'gemini-3.0-pro',
      base64Data,
      mimeType
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

export default router;
