# System Architecture

This document provides a comprehensive overview of the Video to Notion system architecture.

## Monorepo Structure

Video to Notion is a **monorepo** containing two packages:

```
videotonotion/
├── package.json          # Root package (frontend + orchestration)
├── server/
│   └── package.json      # Backend package
└── pnpm-lock.yaml        # Shared lock file
```

### Package Relationship

```mermaid
graph TB
    subgraph "Root Package (Frontend)"
        A[React + Vite App]
        B[Frontend Services]
        C[UI Components]
    end

    subgraph "Server Package (Backend)"
        D[Express.js Server]
        E[YouTube Service]
        F[AI Proxy Service]
    end

    A --> B
    B --> C
    B <-->|HTTP API| D
    D --> E
    D --> F

    style A fill:#61dafb
    style D fill:#68a063
```

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend (Port 3000)"]
        UI[React UI]
        GS[Gemini Service]
        VS[Vertex Service]
        YS[YouTube API Service]
        VU[Video Utils]
    end

    subgraph Server["Backend (Port 3001)"]
        EX[Express Server]
        YT[yt-dlp Service]
        CH[Chunk Service]
        AI[AI Proxy Service]
    end

    subgraph External["External Services"]
        GEM[Gemini API]
        VTX[Vertex AI]
        YTB[YouTube]
    end

    subgraph Storage["Storage"]
        LS[(localStorage)]
        TMP[(Temp Files)]
    end

    UI --> GS
    UI --> VS
    UI --> YS
    UI --> VU

    GS -->|Direct API| GEM
    VS -->|Via Proxy| AI
    YS -->|HTTP| EX

    EX --> YT
    EX --> CH
    EX --> AI

    YT -->|Download| YTB
    AI -->|Auth Proxy| VTX

    UI -->|Save Sessions| LS
    YT -->|Store Videos| TMP
    CH -->|Store Chunks| TMP
```

## Frontend Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 19 | UI rendering and state management |
| Build Tool | Vite 6 | Fast development server and bundling |
| Language | TypeScript | Type safety |
| Icons | Lucide React | UI icons |
| AI Client | @google/genai | Direct Gemini API calls |

### Directory Structure

```
/                           # Root (Frontend)
├── App.tsx                 # Main application, state management
├── main.tsx                # Application entry point
├── index.html              # HTML template
├── components/
│   ├── VideoInput.tsx      # File upload and URL input
│   ├── NotesPreview.tsx    # Rendered notes display
│   ├── ProcessingView.tsx  # Progress indicators
│   ├── Sidebar.tsx         # Session management
│   └── ProviderSelector.tsx # AI provider configuration
├── services/
│   ├── aiProviderService.ts # AI provider abstraction
│   ├── geminiService.ts     # Direct Gemini API integration
│   ├── vertexService.ts     # Vertex AI via backend proxy
│   └── youtubeApiService.ts # YouTube backend communication
├── utils/
│   └── videoUtils.ts        # Base64 conversion, frame extraction
├── types.ts                 # TypeScript interfaces
├── constants.ts             # Configuration constants
├── tsconfig.json            # TypeScript config
└── vite.config.ts           # Vite configuration
```

### State Management

The application uses React's built-in state management with `useState` and `useEffect` hooks. The main state is managed in `App.tsx`:

```typescript
// Core state
const [sessions, setSessions] = useState<VideoSession[]>([]);
const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
```

### VideoSession State Machine

```mermaid
stateDiagram-v2
    [*] --> IDLE: Create Session
    IDLE --> DOWNLOADING: YouTube URL Provided
    IDLE --> READY: File Uploaded
    DOWNLOADING --> READY: Download Complete
    DOWNLOADING --> ERROR: Download Failed
    READY --> UPLOADING: Start Processing
    UPLOADING --> ANALYZING: Video Sent
    ANALYZING --> EXTRACTING_FRAMES: AI Response Received
    EXTRACTING_FRAMES --> COMPLETED: Frames Extracted
    ANALYZING --> ERROR: AI Error
    EXTRACTING_FRAMES --> ERROR: Frame Error
    COMPLETED --> [*]
    ERROR --> [*]
```

## Backend Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Express.js | HTTP server and routing |
| Runtime | Node.js | JavaScript runtime |
| Language | TypeScript | Type safety |
| Video Download | yt-dlp | YouTube video downloading |
| Video Processing | ffmpeg | Video chunking and frame extraction |
| Validation | Zod | Request/response validation |

### Directory Structure

```
server/
├── index.ts                # Express server entry point
├── routes/
│   ├── youtube.ts          # YouTube download/chunk endpoints
│   └── ai.ts               # Vertex AI proxy endpoint
├── services/
│   ├── ytdlpService.ts     # yt-dlp wrapper for downloads
│   ├── chunkService.ts     # ffmpeg video chunking
│   └── aiService.ts        # Vertex AI integration
├── utils/
│   └── urlUtils.ts         # URL validation utilities
├── package.json
├── tsconfig.json
└── VIDEO_REQUIREMENTS.md   # Gemini video constraints
```

### Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant V as Vite Proxy
    participant E as Express Server
    participant S as Services

    C->>V: /api/* request
    V->>E: Forward to :3001
    E->>S: Route handler
    S-->>E: Service response
    E-->>V: HTTP response
    V-->>C: Forward response
```

## AI Provider Architecture

The application supports two AI providers through a unified interface:

### Provider Abstraction

```mermaid
classDiagram
    class AIProvider {
        <<interface>>
        +generateNotesFromVideo(base64, mimeType) NoteSegment[]
    }

    class GeminiProvider {
        -apiKey: string
        -model: string
        +generateNotesFromVideo() NoteSegment[]
    }

    class VertexProvider {
        -projectId: string
        -location: string
        -model: string
        +generateNotesFromVideo() NoteSegment[]
    }

    AIProvider <|.. GeminiProvider
    AIProvider <|.. VertexProvider
```

### Provider Comparison

| Feature | Gemini API | Vertex AI |
|---------|-----------|-----------|
| Authentication | API Key | Google Cloud ADC |
| Call Location | Browser (direct) | Server (proxied) |
| Setup Complexity | Simple | Requires gcloud CLI |
| Billing | Pay-as-you-go | GCP project billing |

### Configuration

```typescript
// Gemini API Configuration
{
  provider: 'gemini',
  apiKey: 'your-api-key',
  model: 'gemini-3-pro-preview'
}

// Vertex AI Configuration
{
  provider: 'vertex',
  projectId: 'your-gcp-project',
  location: 'us-central1',
  model: 'gemini-3-pro-preview'
}
```

## Storage Architecture

### Client-Side Storage (localStorage)

```mermaid
flowchart LR
    subgraph Browser
        A[VideoSession State]
        B[localStorage]
    end

    A -->|Serialize| B
    B -->|Deserialize| A

    note1[Key: videotonotion_sessions]
    note2[Images stripped to save space]
```

**Storage Details:**
- **Key**: `videotonotion_sessions`
- **Capacity**: ~5-10MB (browser limit)
- **Persistence**: Until manual clear or browser data deletion
- **Limitations**: Images are stripped from saved notes to conserve space

### Server-Side Storage (Temporary)

```mermaid
flowchart TB
    subgraph "Temp Directory"
        A[/tmp/videotonotion/]
        B[session-uuid-1/]
        C[session-uuid-2/]
    end

    A --> B
    A --> C

    B --> D[video.mp4]
    B --> E[chunk_0.mp4]
    B --> F[chunk_1.mp4]
```

**Storage Details:**
- **Location**: `{os.tmpdir()}/videotonotion/{sessionId}/`
- **Contents**: Downloaded videos and chunk files
- **Lifecycle**: Auto-cleaned after 1 hour of inactivity
- **Management**: In-memory session Map tracks active sessions

## Communication Patterns

### Vite Proxy Configuration

The frontend uses Vite's proxy to forward API requests to the backend:

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

### Data Flow Summary

| Flow | Method | Description |
|------|--------|-------------|
| File Upload | Frontend only | File → Base64 → Gemini → Notes |
| YouTube | Frontend + Backend | URL → yt-dlp → Chunks → Base64 → Gemini → Notes |
| Frame Extract (local) | Frontend only | Video element → Canvas → JPEG data URL |
| Frame Extract (YouTube) | Frontend + Backend | ffmpeg → JPEG → Base64 |
| Vertex AI | Frontend + Backend | Request → Proxy → Vertex API → Response |

## Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Usage:
```typescript
import { NoteSegment } from '@/types';
import { fileToBase64 } from '@/utils/videoUtils';
```
