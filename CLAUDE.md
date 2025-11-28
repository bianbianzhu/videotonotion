# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server on port 3000
- `npm run build` - Production build with Vite
- `npm run preview` - Preview production build

## Environment

Set `GEMINI_API_KEY` in `.env.local` for the Gemini API.

## Architecture

This is a React + Vite application that converts video lectures into structured Notion-ready notes using Google's Gemini AI.

### Core Flow

1. **Video Input** - User uploads a video file or provides a URL (URL fetching is limited by CORS)
2. **Gemini Analysis** - Video is converted to base64 and sent to Gemini 2.5 Flash for multimodal analysis
3. **Frame Extraction** - Key frames are extracted locally at timestamps identified by Gemini using HTML5 canvas
4. **Notes Output** - Structured segments with timestamps, titles, markdown summaries, and frame images

### Key Files

- `App.tsx` - Main state management, orchestrates the processing pipeline
- `services/geminiService.ts` - Gemini API integration with structured JSON output schema
- `utils/videoUtils.ts` - File-to-base64 conversion and frame extraction using canvas
- `types.ts` - Core interfaces: `NoteSegment`, `VideoSession`, `ProcessingStatus` enum
- `constants.ts` - Gemini model config and video size limits

### State Model

`VideoSession` tracks each video through states: IDLE → DOWNLOADING → READY → UPLOADING → ANALYZING → EXTRACTING_FRAMES → COMPLETED/ERROR

### Path Aliases

`@/*` maps to the project root (configured in tsconfig.json and vite.config.ts).
