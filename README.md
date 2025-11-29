# Video to Notion

A React application that converts video lectures into structured, Notion-ready notes using Google's Gemini AI multimodal capabilities.

## Features

- **Video File Upload** - Upload local video files for analysis
- **YouTube URL Support** - Paste YouTube URLs for server-side processing
- **AI-Powered Analysis** - Uses Gemini AI to analyze video content and generate structured notes
- **Frame Extraction** - Automatically extracts key frames at identified timestamps
- **Markdown Output** - Generates Notion-compatible markdown with timestamps, titles, and summaries
- **Session Management** - Track multiple video processing sessions with progress indicators

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **AI**: Google Gemini API (@google/genai)
- **Backend**: Express.js server for YouTube video handling
- **Icons**: Lucide React

## Prerequisites

- Node.js (v18+)
- pnpm
- Gemini API key can be provided via frontend or in the environment variables
- Vertex AI project ID, region, and model can be provided via frontend or in the environment variables

## Setup

1. Install all dependencies:

   ```bash
   pnpm run install:all
   ```

2. Install ffmpeg and yt-dlp:
   For macOS:

   ```bash
   brew install yt-dlp
   brew install ffmpeg
   ```

3. (Optional)Create `.env.local` in the project root and add your Gemini API key or Vertex AI project ID, region, and model:

   ```
   GEMINI_API_KEY=your_api_key_here
   VERTEX_AI_PROJECT_ID=your_project_id_here
   VERTEX_AI_LOCATION=your_location_here
   VERTEX_AI_MODEL=your_model_here
   ```

4. For YouTube support, configure the server environment in `server/.env`

## Development

Start both the client and server:

```bash
pnpm run dev
```

This runs:

- Frontend on http://localhost:5173
- Backend server for YouTube processing

### Individual Commands

- `pnpm run dev:client` - Start only the Vite dev server
- `pnpm run dev:server` - Start only the backend server
- `pnpm run build` - Production build
- `pnpm run preview` - Preview production build

## How It Works

1. **Input** - Upload a video file or provide a YouTube URL
2. **Processing** - Video is sent to Gemini AI for multimodal analysis
3. **Analysis** - AI identifies key segments with timestamps and generates summaries
4. **Frame Extraction** - Key frames are extracted at identified timestamps using HTML5 canvas
5. **Output** - Structured notes with timestamps, titles, markdown content, and images

## Project Structure

```
├── App.tsx              # Main application component
├── components/          # React components
│   ├── NotesPreview.tsx    # Rendered notes display
│   ├── ProcessingView.tsx  # Progress indicators
│   ├── Sidebar.tsx         # Session management
│   └── VideoInput.tsx      # Upload interface
├── services/            # API integrations
│   ├── geminiService.ts    # Gemini AI client
│   └── youtubeApiService.ts # YouTube API calls
├── server/              # Backend Express server
│   ├── routes/             # API routes
│   └── services/           # Server-side services
├── types.ts             # TypeScript interfaces
└── utils/               # Utility functions
```

## License

MIT
