# CLAUDE.md

Read and understand relevant files before proposing edits. Don't speculate about the code if you haven't read the files.

**ALWAYS use `gemini-3-pro-preview` as the model.**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a **monorepo** with two packages:

```
videotonotion/
├── package.json          # Frontend + root orchestration
├── server/
│   └── package.json      # Backend server
└── pnpm-lock.yaml        # Shared lockfile
```

## Commands

### Development

| Command | Description |
|---------|-------------|
| `pnpm run install:all` | Install all dependencies (frontend + backend) |
| `pnpm run dev` | Run frontend (port 3000) + backend (port 3001) concurrently |
| `pnpm run dev:client` | Run frontend only |
| `pnpm run dev:server` | Run backend only |

### Production

| Command | Description |
|---------|-------------|
| `pnpm run build` | Build frontend with Vite |
| `pnpm run build:server` | Build backend with TypeScript |
| `pnpm run preview` | Preview production frontend build |

## Environment Variables

### Frontend (`.env.local` in root)

```bash
GEMINI_API_KEY=your_api_key          # Optional - can be set in UI
VITE_VERTEX_AI_PROJECT_ID=project    # Optional - for Vertex AI
VITE_VERTEX_AI_LOCATION=us-central1  # Optional
VITE_VERTEX_AI_MODEL=gemini-3-pro-preview
VITE_CHUNK_SIZE_MB=15                # Optional - chunk threshold (default: 15)
```

### Backend (`server/.env`)

```bash
PORT=3001                            # Server port (default: 3001)
VERTEX_AI_PROJECT_ID=your_project    # Required for Vertex AI
VERTEX_AI_LOCATION=us-central1       # Required for Vertex AI
VERTEX_AI_MODEL=gemini-3-pro-preview # Optional
CHUNK_SIZE_MB=15                     # Optional - video chunk size (default: 15)
```

> **Note:** Smaller chunk sizes (e.g., 5-10MB) reduce tokens per API request, helping avoid 429 rate limit errors.

## Architecture

This is a full-stack application that converts video lectures into structured Notion-ready notes using Google's Gemini AI.

### System Overview

```
Frontend (React + Vite, Port 3000)
    │
    ├── Direct Gemini API calls (with API key)
    │
    └── Vite Proxy (/api/*) ──► Backend (Express, Port 3001)
                                    │
                                    ├── YouTube download (yt-dlp)
                                    ├── Video chunking (ffmpeg)
                                    └── Vertex AI proxy
```

### Core Flow

1. **Video Input** - User uploads a file OR provides a YouTube URL
2. **YouTube Processing** (if URL) - Backend downloads via yt-dlp, chunks large videos with ffmpeg
3. **AI Analysis** - Video converted to base64, sent to Gemini 3 Pro Preview
4. **Frame Extraction** - Key frames extracted at AI-identified timestamps (canvas for local, ffmpeg for YouTube)
5. **Notes Output** - Structured segments with timestamps, titles, markdown, and images
6. **Persistence** - Sessions saved to browser localStorage (images stripped to save space)

### Key Files - Frontend

| File | Purpose |
|------|---------|
| `App.tsx` | Main state management, orchestrates pipeline |
| `components/VideoInput.tsx` | File upload and URL input UI |
| `components/NotesPreview.tsx` | Rendered notes display and export |
| `components/ProviderSelector.tsx` | AI provider configuration |
| `services/geminiService.ts` | Direct Gemini API integration |
| `services/vertexService.ts` | Vertex AI via backend proxy |
| `services/youtubeApiService.ts` | YouTube backend communication |
| `utils/videoUtils.ts` | Base64 conversion, canvas frame extraction |
| `types.ts` | Core interfaces: `NoteSegment`, `VideoSession`, `ProcessingStatus` |
| `constants.ts` | Model config, video size limits |

### Key Files - Backend

| File | Purpose |
|------|---------|
| `server/index.ts` | Express server entry point |
| `server/routes/youtube.ts` | YouTube download/chunk endpoints |
| `server/routes/ai.ts` | Vertex AI proxy endpoint |
| `server/services/ytdlpService.ts` | yt-dlp wrapper |
| `server/services/chunkService.ts` | ffmpeg video chunking |
| `server/services/aiService.ts` | Vertex AI integration |

### State Model

`VideoSession` tracks each video through states:

```
IDLE → DOWNLOADING → READY → UPLOADING → ANALYZING → EXTRACTING_FRAMES → COMPLETED
                                                                        ↘ ERROR
```

### Storage

- **Client**: Browser localStorage (`videotonotion_sessions`)
- **Server**: Temp directory for downloads (auto-cleanup after 1 hour)

### Path Aliases

`@/*` maps to the project root (configured in tsconfig.json and vite.config.ts).

## Documentation

Comprehensive documentation is available in `/docs/`:

- `docs/ARCHITECTURE.md` - System architecture with diagrams
- `docs/VIDEO_PROCESSING.md` - End-to-end processing pipeline
- `docs/API_REFERENCE.md` - Backend API documentation
- `docs/DEVELOPMENT.md` - Development setup and troubleshooting
- `docs/NOTION_EXPORT.md` - Export guide

## External Dependencies

Requires system-level installation:

```bash
# macOS
brew install yt-dlp ffmpeg

# For Vertex AI
gcloud auth application-default login
```
