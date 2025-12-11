import express from 'express';
import cors from 'cors';
import youtubeRouter from './routes/youtube.js';
import aiRouter from './routes/ai.js';
import uploadRouter from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '100mb' })); // Increased limit for video data

// Routes
app.use('/api/youtube', youtubeRouter);
app.use('/api/ai', aiRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/youtube/info?url=...');
  console.log('  POST /api/youtube/download');
  console.log('  GET  /api/youtube/chunk/:sessionId/:chunkId');
  console.log('  GET  /api/youtube/full/:sessionId');
  console.log('  DELETE /api/youtube/session/:sessionId');
  console.log('  POST /api/upload');
  console.log('  GET  /api/upload/chunk/:sessionId/:chunkId');
  console.log('  GET  /api/upload/full/:sessionId');
  console.log('  GET  /api/upload/frame/:sessionId?timestamp=...');
  console.log('  DELETE /api/upload/session/:sessionId');
  console.log('  POST /api/ai/vertex/analyze');
});
