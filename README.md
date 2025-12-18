# Video to Notion

A full-stack application that converts video lectures into structured, Notion-ready notes using Google's Gemini AI multimodal capabilities.

## Features

- **Video File Upload** - Upload local video files for analysis
- **YouTube URL Support** - Paste YouTube URLs for server-side processing
- **AI-Powered Analysis** - Uses Gemini 3 Pro Preview for multimodal video analysis
- **Frame Extraction** - Automatically extracts key frames at identified timestamps
- **Markdown Output** - Generates Notion-compatible markdown with timestamps, titles, and summaries
- **Session Management** - Track multiple video processing sessions with progress indicators
- **Dual AI Provider** - Support for both direct Gemini API and Google Vertex AI
- **Flexible Video Processing** - Multiple strategies for different video sizes and providers

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript |
| Backend | Express.js, Node.js, TypeScript |
| Database | SQLite (better-sqlite3) |
| AI | Google Gemini API, Vertex AI |
| Video Processing | yt-dlp, ffmpeg |
| Icons | Lucide React |

## Prerequisites

- Node.js (v18+)
- pnpm
- ffmpeg (for video processing)
- yt-dlp (for YouTube downloads)

## Quick Start

### 1. Install Dependencies

```bash
pnpm run install:all
```

### 2. Install System Dependencies

```bash
# macOS
brew install yt-dlp ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
pip install yt-dlp
```

### 3. Configure Environment (Optional)

Create `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_api_key_here
```

Or provide the API key in the UI.

### 4. Start Development Server

```bash
pnpm run dev
```

This runs:
- **Frontend** on http://localhost:3000
- **Backend** on http://localhost:3001

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. INPUT                                                   │
│     Upload video file OR paste YouTube URL                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. PROCESSING (YouTube only)                               │
│     Backend downloads via yt-dlp, chunks large videos       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. AI ANALYSIS                                             │
│     Video converted to base64, sent to Gemini AI            │
│     AI identifies key topics, timestamps, and summaries     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. FRAME EXTRACTION                                        │
│     Key frames extracted at AI-identified timestamps        │
│     - Local files: HTML5 Canvas                             │
│     - YouTube: ffmpeg on server                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. OUTPUT                                                  │
│     Structured notes with timestamps, titles, summaries,    │
│     and frame images. Export to Notion or download HTML.    │
└─────────────────────────────────────────────────────────────┘
```

## Video Analysis Strategies

The app supports different strategies depending on your AI provider:

### Gemini API (with API Key)

| Strategy | Best For | Max Size | Description |
|----------|----------|----------|-------------|
| **Inline** | Reliability | ~20MB/chunk | Chunks large videos, processes sequentially |
| **Files API** | Large videos | 2GB | Uploads entire video to Gemini, no chunking |

### Vertex AI (with GCP Auth)

| Strategy | Best For | Max Size | Description |
|----------|----------|----------|-------------|
| **Inline** | Reliability | ~20MB/chunk | Chunks large videos, processes sequentially |
| **GCS Bucket** | Large videos | Unlimited | Uploads video to Google Cloud Storage, references via `gs://` URI |

> **Note:** Files API does NOT work with Vertex AI. Use GCS Bucket strategy for large videos with Vertex AI.

### GCS Bucket Setup (for Vertex AI)

1. Create a GCS bucket in your GCP project
2. Grant your account the following IAM permissions:
   - `roles/storage.objectCreator` - to upload videos
   - `roles/storage.objectViewer` - for Vertex AI to read
3. Enter the bucket name in the UI when selecting "GCS Bucket" strategy

## Project Structure

```
videotonotion/
├── App.tsx                 # Main application component
├── main.tsx                # React entry point
├── types.ts                # TypeScript interfaces
├── constants.ts            # Configuration constants
│
├── components/             # React UI components
│   ├── VideoInput.tsx      # File upload & URL input
│   ├── NotesPreview.tsx    # Rendered notes display
│   ├── ProcessingView.tsx  # Progress indicators
│   ├── Sidebar.tsx         # Session management
│   └── ProviderSelector.tsx # AI provider selection
│
├── services/               # Frontend services
│   ├── aiProviderService.ts    # AI provider abstraction
│   ├── geminiService.ts        # Direct Gemini API
│   ├── vertexService.ts        # Vertex AI via proxy
│   └── youtubeApiService.ts    # YouTube backend client
│
├── utils/                  # Utility functions
│   └── videoUtils.ts       # Base64 & frame extraction
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # System architecture
│   ├── VIDEO_PROCESSING.md # Processing pipeline
│   ├── API_REFERENCE.md    # API documentation
│   ├── DEVELOPMENT.md      # Development guide
│   └── NOTION_EXPORT.md    # Export guide
│
└── server/                 # Backend server
    ├── index.ts            # Express server entry
    ├── routes/
    │   ├── youtube.ts      # YouTube endpoints
    │   ├── ai.ts           # AI proxy endpoints (Vertex AI + GCS)
    │   └── sessions.ts     # Session CRUD endpoints
    ├── services/
    │   ├── ytdlpService.ts # yt-dlp wrapper
    │   ├── chunkService.ts # Video chunking
    │   ├── aiService.ts    # Vertex AI integration
    │   ├── gcsService.ts   # Google Cloud Storage operations
    │   └── imageStorageService.ts # Image file operations
    ├── db/
    │   ├── index.ts        # SQLite connection
    │   ├── schema.ts       # Database schema
    │   └── sessionRepository.ts # Data access layer
    ├── data/               # (gitignored) Runtime data
    │   ├── videotonotion.db # SQLite database
    │   └── images/         # Stored note images
    └── VIDEO_REQUIREMENTS.md # Gemini video limits
```

## Data Persistence

- **Session History**: Stored in SQLite database (`server/data/videotonotion.db`)
- **Note Images (Screenshots)**: Saved to filesystem (`server/data/images/`) and served via API
- **Server Downloads**: Stored in temp directory, auto-cleaned after 1 hour
- **Migration**: Existing localStorage data is automatically migrated on first load

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Run frontend + backend concurrently |
| `pnpm run dev:client` | Run frontend only (port 3000) |
| `pnpm run dev:server` | Run backend only (port 3001) |
| `pnpm run build` | Build frontend for production |
| `pnpm run build:server` | Build backend for production |
| `pnpm run preview` | Preview production build |
| `pnpm run install:all` | Install all dependencies |

## Environment Variables

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No* | Gemini API key |
| `VITE_VERTEX_AI_PROJECT_ID` | No | GCP project ID |
| `VITE_VERTEX_AI_LOCATION` | No | Vertex AI region |
| `VITE_VERTEX_AI_MODEL` | No | Model name |

*Can be provided via UI

### Backend (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `VERTEX_AI_PROJECT_ID` | For Vertex | GCP project ID |
| `VERTEX_AI_LOCATION` | For Vertex | Vertex AI region |
| `VERTEX_AI_MODEL` | No | Model name |

## Documentation

For detailed documentation, see the `/docs` folder:

- [Architecture](./docs/ARCHITECTURE.md) - System design and diagrams
- [Video Processing](./docs/VIDEO_PROCESSING.md) - Pipeline details
- [API Reference](./docs/API_REFERENCE.md) - Backend endpoints
- [Development Guide](./docs/DEVELOPMENT.md) - Setup and troubleshooting
- [Notion Export Guide](./docs/NOTION_EXPORT.md) - Using generated notes

## Troubleshooting

### better-sqlite3 Native Module Error

If you see an error like this when starting the server:

```
Error: Could not locate the bindings file. Tried:
 → .../better-sqlite3/build/better_sqlite3.node
 → .../better-sqlite3/build/Debug/better_sqlite3.node
 → .../better-sqlite3/build/Release/better_sqlite3.node
```

**Cause**: pnpm v10+ blocks native module build scripts by default for security. The `better-sqlite3` package requires compiling C++ code during installation.

**Solution 1** - Rebuild the native module manually:

```bash
cd server
npm rebuild better-sqlite3
```

**Solution 2** - Approve builds for better-sqlite3 (interactive):

```bash
cd server
pnpm approve-builds
# Select better-sqlite3 from the list
```

**Solution 3** - Pre-approve in package.json (recommended for teams):

Add this to `server/package.json`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3"]
  }
}
```

Then reinstall:

```bash
cd server
pnpm install
```

## License

MIT
