# Video to Notion - Documentation

Welcome to the Video to Notion documentation. This guide provides comprehensive information about the project's architecture, video processing pipeline, API reference, and development setup.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System architecture, monorepo structure, and component overview |
| [Video Processing](./VIDEO_PROCESSING.md) | End-to-end video processing pipeline with flow diagrams |
| [API Reference](./API_REFERENCE.md) | Backend API endpoints, request/response formats |
| [Development Guide](./DEVELOPMENT.md) | Setup instructions, environment variables, and troubleshooting |
| [Notion Export Guide](./NOTION_EXPORT.md) | How to use generated notes in Notion |

## Project Overview

Video to Notion is a full-stack application that converts video lectures into structured, Notion-ready notes using Google's Gemini AI multimodal capabilities.

### Key Features

- **Video File Upload** - Direct local video file processing
- **YouTube URL Support** - Server-side YouTube video downloading and processing
- **AI-Powered Analysis** - Gemini 3 Pro Preview for multimodal video analysis
- **Frame Extraction** - Automatic key frame extraction at identified timestamps
- **Markdown Output** - Notion-compatible markdown with timestamps and images
- **Dual AI Provider** - Support for both Gemini API and Vertex AI

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript |
| Backend | Express.js, Node.js |
| AI | Google Gemini API, Vertex AI |
| Video Processing | yt-dlp, ffmpeg |
| Storage | Browser localStorage (client), Temp filesystem (server) |

## Getting Started

For setup instructions, see the [Development Guide](./DEVELOPMENT.md).

For understanding how video processing works, see [Video Processing](./VIDEO_PROCESSING.md).
