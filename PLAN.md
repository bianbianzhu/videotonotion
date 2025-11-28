# Plan: YouTube Download + Dual AI Provider Support

## Summary
1. Node.js Express backend using yt-dlp to download YouTube videos
2. Chunk large videos with ffmpeg for processing
3. Support both **Gemini API** (with API key) and **Vertex AI** (with project ID, region, no API key)

## Prerequisites
```bash
brew install yt-dlp
brew install ffmpeg
```

For Vertex AI: Google Cloud SDK with `gcloud auth application-default login`

## Quick Start
```bash
pnpm run install:all   # Install all dependencies
pnpm run dev           # Start both frontend and backend
```

---

## Architecture

### Frontend (Vite + React)
- **Gemini API**: Called directly from browser using `@google/genai`
- **Vertex AI**: Proxied through backend (requires Google Cloud credentials)

### Backend (Express, port 3001)
- YouTube download via yt-dlp
- Video chunking via ffmpeg
- Vertex AI proxy endpoint

---

## Server Files

```
server/
├── index.ts                  # Express server entry
├── routes/
│   ├── youtube.ts            # YouTube download/chunk endpoints
│   └── ai.ts                 # Vertex AI proxy endpoint
├── services/
│   ├── ytdlpService.ts       # yt-dlp wrapper
│   ├── chunkService.ts       # ffmpeg video chunking
│   └── aiService.ts          # Vertex AI integration
├── utils/urlUtils.ts         # URL validation
├── package.json
└── tsconfig.json
```

## Frontend Files

```
services/
├── aiProviderService.ts      # Unified AI provider interface
├── geminiService.ts          # Gemini API (direct)
├── vertexService.ts          # Vertex AI (via backend)
└── youtubeApiService.ts      # YouTube API client

components/
└── ProviderSelector.tsx      # Provider config UI
```

---

## API Endpoints

### YouTube
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/youtube/info?url=` | Get video metadata |
| POST | `/api/youtube/download` | Download + chunk video |
| GET | `/api/youtube/chunk/:sessionId/:chunkId` | Stream specific chunk |
| GET | `/api/youtube/full/:sessionId` | Stream full video |
| DELETE | `/api/youtube/session/:sessionId` | Cleanup session |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/vertex/analyze` | Analyze video with Vertex AI |

---

## Provider Configuration

**Gemini API:**
```typescript
{
  provider: 'gemini',
  apiKey: string
}
```

**Vertex AI:**
```typescript
{
  provider: 'vertex',
  projectId: string,
  location: string,    // e.g., 'us-central1'
  model?: string       // defaults to 'gemini-2.0-flash'
}
```

---

## Chunk Processing Flow

1. Frontend calls `/api/youtube/download` with YouTube URL
2. Server downloads video with yt-dlp, chunks with ffmpeg (~18MB each)
3. Returns `{ sessionId, chunks: [{ id, startTime, endTime }], title }`
4. Frontend fetches each chunk, processes through AI provider
5. Timestamps adjusted: `segment.timestamp += chunk.startTime`
6. Results merged into single notes array

---

## npm Scripts

```json
{
  "dev": "concurrently -n client,server \"pnpm run dev:client\" \"pnpm run dev:server\"",
  "dev:client": "vite",
  "dev:server": "cd server && pnpm run dev",
  "install:all": "pnpm install && cd server && pnpm install"
}
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Invalid YouTube URL | 400 - "Invalid YouTube URL" |
| Video not found | 404 - "Video not available" |
| Age-restricted | 403 - "Video requires sign-in" |
| yt-dlp failure | 500 - "Download failed" |
| Vertex auth error | "Run: gcloud auth application-default login" |
