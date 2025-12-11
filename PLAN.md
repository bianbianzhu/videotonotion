# Video to Notion - Roadmap

This document outlines the current implementation status and planned features for Video to Notion.

## Current Implementation (v1.0)

### Completed Features

- [x] Video file upload with drag-and-drop
- [x] YouTube URL support via backend (yt-dlp)
- [x] Video chunking for large files (ffmpeg)
- [x] Dual AI provider support (Gemini API + Vertex AI)
- [x] Structured note generation with timestamps
- [x] Frame extraction (canvas for local, ffmpeg for YouTube)
- [x] Session management with progress tracking
- [x] Browser localStorage persistence
- [x] Copy to clipboard export
- [x] HTML download export

### Architecture

| Component | Technology | Status |
|-----------|------------|--------|
| Frontend | React 19 + Vite | Complete |
| Backend | Express.js | Complete |
| AI Analysis | Gemini 3 Pro Preview | Complete |
| Video Processing | yt-dlp + ffmpeg | Complete |
| Storage | localStorage + temp files | Complete |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/youtube/info?url=` | Get video metadata |
| POST | `/api/youtube/download` | Download + chunk video |
| GET | `/api/youtube/chunk/:sessionId/:chunkId` | Stream specific chunk |
| GET | `/api/youtube/full/:sessionId` | Stream full video |
| GET | `/api/youtube/frame/:sessionId?timestamp=` | Extract frame |
| DELETE | `/api/youtube/session/:sessionId` | Cleanup session |
| POST | `/api/ai/vertex/analyze` | Vertex AI proxy |

---

## What's Next

### Phase 2: Enhanced Export

- [ ] **Direct Notion API Integration**
  - OAuth authentication with Notion
  - Automatic page creation in user's workspace
  - Database entries for video notes
  - Clickable timestamp links

- [ ] **Export Format Options**
  - Markdown file download
  - PDF export
  - JSON export for programmatic use

### Phase 3: Improved Analysis

- [ ] **Transcript Support**
  - YouTube auto-generated captions
  - User-uploaded SRT/VTT files
  - Transcript alongside AI analysis

- [ ] **Custom Prompts**
  - User-configurable analysis prompts
  - Different note formats (summary, detailed, Q&A)
  - Language selection

- [ ] **Better Frame Selection**
  - AI-guided frame selection (slides, diagrams)
  - Multiple frames per segment option
  - Frame quality optimization

### Phase 4: User Experience

- [ ] **Account System**
  - User authentication
  - Cloud sync of notes history
  - Share notes with others

- [ ] **UI Improvements**
  - Dark mode
  - Mobile responsive design
  - Keyboard shortcuts
  - Video preview player

### Phase 5: Platform Support

- [ ] **Additional Video Sources**
  - Vimeo support
  - Direct video URL support (improved)
  - Google Drive video links
  - Loom integration

- [ ] **Deployment**
  - Docker containerization
  - One-click deploy (Vercel, Railway)
  - Self-hosted documentation

---

## Known Issues

### Current Limitations

1. **Storage**
   - localStorage limited to ~5-10MB
   - Images stripped from saved sessions
   - No cross-device sync

2. **Video Processing**
   - Large videos may timeout
   - Some YouTube videos blocked (age-restricted, private)
   - Frame extraction can fail on corrupted videos

3. **AI Analysis**
   - Quota limits on Gemini API
   - 45-minute max video length with audio
   - Analysis quality depends on video content

### TODOs in Code

| File | Issue | Description |
|------|-------|-------------|
| `App.tsx:248` | Frame cleanup disabled | YouTube session cleanup commented out |

---

## Contributing

When contributing to this project:

1. Check the roadmap above for planned features
2. Review existing issues and TODOs
3. Follow the coding patterns in the codebase
4. Update documentation as needed

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for setup instructions.
