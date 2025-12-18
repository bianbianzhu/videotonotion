# Development Guide

This guide covers everything you need to set up and develop Video to Notion locally.

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | v18+ | JavaScript runtime |
| pnpm | Latest | Package manager |
| ffmpeg | Latest | Video processing |
| yt-dlp | Latest | YouTube downloads |

### Optional Software

| Software | Purpose |
|----------|---------|
| Google Cloud SDK | Required for Vertex AI |

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/videotonotion.git
cd videotonotion
```

### 2. Install Dependencies

```bash
# Install all dependencies (frontend + backend)
pnpm run install:all
```

This command runs:
- `pnpm install` in the root (frontend)
- `pnpm install` in the `/server` directory (backend)

### 3. Install System Dependencies

#### macOS (Homebrew)

```bash
brew install yt-dlp
brew install ffmpeg
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

#### Windows (Chocolatey)

```powershell
choco install ffmpeg
choco install yt-dlp
```

### 4. Verify Installation

```bash
# Check ffmpeg
ffmpeg -version

# Check yt-dlp
yt-dlp --version
```

## Environment Variables

### Frontend Environment (`.env.local`)

Create `.env.local` in the project root:

```bash
# Gemini API (optional - can be set in UI)
GEMINI_API_KEY=your_gemini_api_key

# Vertex AI (optional - can be set in UI)
VITE_VERTEX_AI_PROJECT_ID=your_gcp_project_id
VITE_VERTEX_AI_LOCATION=us-central1
VITE_VERTEX_AI_MODEL=gemini-3-pro-preview
```

### Backend Environment (`server/.env`)

Create `.env` in the `/server` directory:

```bash
# Server port (optional, default: 3001)
PORT=3001

# Vertex AI (required if using Vertex AI)
VERTEX_AI_PROJECT_ID=your_gcp_project_id
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-3-pro-preview
```

### Environment Variable Reference

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `GEMINI_API_KEY` | `.env.local` | No* | Gemini API key |
| `VITE_VERTEX_AI_PROJECT_ID` | `.env.local` | No | GCP project for Vertex AI |
| `VITE_VERTEX_AI_LOCATION` | `.env.local` | No | Vertex AI region |
| `VITE_VERTEX_AI_MODEL` | `.env.local` | No | AI model name |
| `PORT` | `server/.env` | No | Backend server port |
| `VERTEX_AI_PROJECT_ID` | `server/.env` | No** | GCP project for backend |
| `VERTEX_AI_LOCATION` | `server/.env` | No** | Vertex AI region |
| `VERTEX_AI_MODEL` | `server/.env` | No** | AI model name |

\* Can be provided via UI
\*\* Required only if using Vertex AI

## Running the Application

### Development Mode

```bash
# Run both frontend and backend concurrently
pnpm run dev
```

This starts:
- **Frontend**: http://localhost:3000 (Vite dev server)
- **Backend**: http://localhost:3001 (Express server)

### Individual Services

```bash
# Frontend only
pnpm run dev:client

# Backend only
pnpm run dev:server
```

### Production Build

```bash
# Build frontend
pnpm run build

# Build backend
pnpm run build:server

# Preview production frontend
pnpm run preview
```

## Project Structure

```
videotonotion/
├── .env.local              # Frontend environment variables
├── .gitignore
├── package.json            # Frontend package + root scripts
├── pnpm-lock.yaml          # Shared lockfile
├── tsconfig.json           # Frontend TypeScript config
├── vite.config.ts          # Vite configuration
├── index.html              # HTML entry point
├── main.tsx                # React entry point
├── App.tsx                 # Main application component
│
├── components/             # React UI components
│   ├── VideoInput.tsx      # File upload & URL input
│   ├── NotesPreview.tsx    # Rendered notes display
│   ├── ProcessingView.tsx  # Progress indicators
│   ├── Sidebar.tsx         # Session management
│   └── ProviderSelector.tsx# AI provider selection
│
├── services/               # Frontend services
│   ├── aiProviderService.ts    # AI provider abstraction
│   ├── geminiService.ts        # Direct Gemini API calls
│   ├── vertexService.ts        # Vertex AI via backend
│   ├── youtubeApiService.ts    # YouTube backend client
│   ├── sessionApiService.ts    # Session CRUD API client
│   └── migrationService.ts     # localStorage migration
│
├── utils/                  # Frontend utilities
│   └── videoUtils.ts       # Base64 & frame extraction
│
├── types.ts                # TypeScript interfaces
├── constants.ts            # Configuration constants
│
├── docs/                   # Documentation
│   ├── README.md           # Documentation index
│   ├── ARCHITECTURE.md     # System architecture
│   ├── VIDEO_PROCESSING.md # Processing pipeline
│   ├── API_REFERENCE.md    # API documentation
│   ├── DEVELOPMENT.md      # This file
│   └── NOTION_EXPORT.md    # Export guide
│
└── server/                 # Backend package
    ├── .env                # Backend environment variables
    ├── package.json        # Backend package
    ├── tsconfig.json       # Backend TypeScript config
    ├── index.ts            # Express server entry
    │
    ├── routes/             # API route handlers
    │   ├── youtube.ts      # YouTube endpoints
    │   ├── ai.ts           # AI proxy endpoints
    │   └── sessions.ts     # Session CRUD endpoints
    │
    ├── services/           # Backend services
    │   ├── ytdlpService.ts # yt-dlp wrapper
    │   ├── chunkService.ts # ffmpeg chunking
    │   ├── aiService.ts    # Vertex AI integration
    │   └── imageStorageService.ts # Image file operations
    │
    ├── db/                 # Database layer
    │   ├── index.ts        # SQLite connection
    │   ├── schema.ts       # Database schema
    │   └── sessionRepository.ts # Data access layer
    │
    ├── data/               # (gitignored) Runtime data
    │   ├── videotonotion.db # SQLite database
    │   └── images/         # Stored note images
    │
    ├── utils/              # Backend utilities
    │   └── urlUtils.ts     # URL validation
    │
    └── VIDEO_REQUIREMENTS.md # Gemini video limits
```

## npm Scripts Reference

### Root Package Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `concurrently ...` | Run frontend + backend |
| `dev:client` | `vite` | Run frontend only |
| `dev:server` | `cd server && pnpm run dev` | Run backend only |
| `build` | `vite build` | Build frontend for production |
| `build:server` | `cd server && pnpm run build` | Build backend |
| `preview` | `vite preview` | Preview production build |
| `install:all` | `pnpm install && cd server && pnpm install` | Install all dependencies |

### Server Package Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch index.ts` | Run with hot reload |
| `build` | `tsc` | Compile TypeScript |
| `start` | `node dist/index.js` | Run compiled code |

## Vertex AI Setup (Optional)

If you want to use Vertex AI instead of the Gemini API:

### 1. Install Google Cloud SDK

```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate

```bash
# Login to Google Cloud
gcloud auth login

# Set up Application Default Credentials
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 3. Enable Required APIs

```bash
gcloud services enable aiplatform.googleapis.com
```

### 4. Configure Environment

Add to `server/.env`:
```bash
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-3-pro-preview
```

## GCS Bucket Setup (for Vertex AI Large Videos)

When using Vertex AI with large videos, you need to set up a GCS bucket since **Files API does NOT work with Vertex AI**.

### 1. Create a GCS Bucket

```bash
# Create a bucket (replace with your preferred name and region)
gsutil mb -l us-central1 gs://your-video-bucket-name

# Or via Google Cloud Console:
# https://console.cloud.google.com/storage/browser
```

### 2. Set Up IAM Permissions

Your account needs these permissions on the bucket:

```bash
# Grant storage object creator (to upload videos)
gsutil iam ch user:YOUR_EMAIL@domain.com:objectCreator gs://your-video-bucket-name

# Grant storage object viewer (for Vertex AI to read)
gsutil iam ch user:YOUR_EMAIL@domain.com:objectViewer gs://your-video-bucket-name
```

**Alternative: Use predefined roles:**
```bash
# Storage Object Admin (includes create, read, delete)
gcloud storage buckets add-iam-policy-binding gs://your-video-bucket-name \
  --member="user:YOUR_EMAIL@domain.com" \
  --role="roles/storage.objectAdmin"
```

### 3. Enable Vertex AI to Access GCS

If Vertex AI cannot access your GCS files, ensure:
1. The bucket is in the same GCP project
2. Or grant the Vertex AI service account access:

```bash
# Get your project's Vertex AI service account
gcloud ai service-accounts describe

# Grant read access to the bucket
gsutil iam ch serviceAccount:SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com:objectViewer gs://your-video-bucket-name
```

### 4. Usage in the Application

1. Select "Vertex AI" as the provider
2. Choose "GCS Bucket" strategy
3. Enter your bucket name (e.g., `your-video-bucket-name`)
4. Upload your video - it will be stored in `gs://your-bucket/videotonotion/{sessionId}/{timestamp}.mp4`
5. Files are automatically cleaned up after analysis

## Common Issues & Troubleshooting

### yt-dlp Errors

**Error:** `yt-dlp: command not found`

**Solution:** Install yt-dlp:
```bash
# macOS
brew install yt-dlp

# Or via pip
pip install yt-dlp
```

**Error:** `Video unavailable`

**Solution:** Video may be:
- Private or deleted
- Age-restricted (requires cookies)
- Region-locked

### ffmpeg Errors

**Error:** `ffmpeg: command not found`

**Solution:** Install ffmpeg:
```bash
brew install ffmpeg
```

**Error:** `Output file is empty`

**Solution:** Check video format is supported:
```bash
ffprobe input.mp4
```

### Gemini API Errors

**Error:** `API key not valid`

**Solution:**
1. Get a new key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to `.env.local` or enter in UI

**Error:** `Quota exceeded`

**Solution:**
1. Wait for quota reset (usually daily)
2. Or upgrade your API plan

### Vertex AI Errors

**Error:** `Could not load the default credentials`

**Solution:**
```bash
gcloud auth application-default login
```

**Error:** `Permission denied`

**Solution:**
1. Ensure Vertex AI API is enabled
2. Check IAM permissions for your account

### GCS Errors (Vertex AI + GCS Strategy)

**Error:** `GCS bucket name is required`

**Solution:** Enter the bucket name in the UI when using GCS strategy.

**Error:** `The specified bucket does not exist`

**Solution:** Verify the bucket name is correct and exists in your GCP project.

**Error:** `Permission denied. Ensure your account has storage.objectCreator role`

**Solution:**
```bash
# Grant storage permissions
gcloud storage buckets add-iam-policy-binding gs://your-bucket \
  --member="user:YOUR_EMAIL@domain.com" \
  --role="roles/storage.objectAdmin"
```

**Error:** `Cannot access GCS file. Ensure the file exists and Vertex AI has permission`

**Solution:**
1. Ensure the bucket is in the same GCP project as Vertex AI
2. Grant the Vertex AI service account read access to the bucket
3. Check that the file was uploaded successfully

### Port Conflicts

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3002 pnpm run dev:client
```

### better-sqlite3 Native Module Error

**Error:** `Could not locate the bindings file`

```
Error: Could not locate the bindings file. Tried:
 → .../better-sqlite3/build/better_sqlite3.node
 → .../better-sqlite3/build/Debug/better_sqlite3.node
 → .../better-sqlite3/build/Release/better_sqlite3.node
```

**Cause:** pnpm v10+ blocks native module build scripts by default for security. The `better-sqlite3` package requires compiling C++ code during installation.

**Solution 1** - Rebuild the native module manually:
```bash
cd server
npm rebuild better-sqlite3
```

**Solution 2** - Approve builds interactively:
```bash
cd server
pnpm approve-builds
# Select better-sqlite3 from the list
```

**Solution 3** - Pre-approve in package.json (already configured):
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3"]
  }
}
```

### Database Issues

**Error:** Database file locked or corrupted

**Solution:**
1. Stop all running server instances
2. Delete the database file: `rm server/data/videotonotion.db`
3. Restart the server (schema will be recreated)

**Error:** Sessions not persisting

**Solution:**
1. Ensure the server is running (database is on backend)
2. Check browser console for API errors
3. Verify `server/data/` directory exists and is writable

## Development Tips

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend**: Vite HMR (instant)
- **Backend**: tsx watch (restarts on save)

### Path Aliases

Use `@/` for imports from project root:

```typescript
// Instead of
import { NoteSegment } from '../../../types';

// Use
import { NoteSegment } from '@/types';
```

### TypeScript Strict Mode

The backend uses strict TypeScript:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

### Debugging

#### Frontend (Chrome DevTools)

1. Open DevTools (F12)
2. Go to Sources tab
3. Find files under `localhost:3000`
4. Set breakpoints

#### Backend (VS Code)

Add to `.vscode/launch.json`:
```json
{
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Server",
      "port": 9229
    }
  ]
}
```

Run server with inspect:
```bash
cd server && node --inspect -r tsx index.ts
```

## Testing

Currently, the project doesn't have automated tests. When adding tests:

### Recommended Stack

| Type | Tool |
|------|------|
| Unit Tests | Vitest |
| E2E Tests | Playwright |
| API Tests | Supertest |

### Running Tests (Future)

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:coverage
```
