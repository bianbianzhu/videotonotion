# API Reference

This document provides a complete reference for the Video to Notion backend API.

## Base URL

- **Development:** `http://localhost:3001`
- **Via Vite Proxy:** `http://localhost:3000/api` (recommended)

## Authentication

Currently, the API does not require authentication. For Vertex AI endpoints, Google Cloud Application Default Credentials (ADC) must be configured on the server.

---

## Health Check

### GET /api/health

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## YouTube Endpoints

### GET /api/youtube/info

Get metadata for a YouTube video without downloading.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | YouTube video URL |

**Example Request:**
```bash
curl "http://localhost:3001/api/youtube/info?url=https://youtube.com/watch?v=VIDEO_ID"
```

**Success Response (200):**
```json
{
  "title": "Introduction to React Hooks",
  "duration": 1800,
  "thumbnail": "https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg",
  "channel": "React Tutorials",
  "uploadDate": "2024-01-10"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid YouTube URL |
| 404 | Video not found |
| 403 | Video is private or age-restricted |

---

### POST /api/youtube/download

Download a YouTube video and optionally chunk it for processing.

**Request Body:**
```json
{
  "url": "https://youtube.com/watch?v=VIDEO_ID"
}
```

**Success Response (200):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Introduction to React Hooks",
  "duration": 1800,
  "chunks": [
    { "id": 0, "startTime": 0, "endTime": 600 },
    { "id": 1, "startTime": 600, "endTime": 1200 },
    { "id": 2, "startTime": 1200, "endTime": 1800 }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | UUID for this download session |
| `title` | string | Video title from YouTube |
| `duration` | number | Total duration in seconds |
| `chunks` | array | Chunk info (empty if video is small enough) |

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid YouTube URL | URL format not recognized |
| 403 | Video requires sign-in | Age-restricted or private video |
| 404 | Video not available | Video deleted or unavailable in region |
| 500 | Download failed | yt-dlp execution error |

---

### GET /api/youtube/chunk/:sessionId/:chunkId

Stream a specific video chunk.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Session ID from download response |
| `chunkId` | number | Chunk index (0-based) |

**Example Request:**
```bash
curl "http://localhost:3001/api/youtube/chunk/550e8400-e29b-41d4-a716-446655440000/0"
```

**Success Response (200):**
- **Content-Type:** `video/mp4`
- **Body:** Binary video data (streamable)

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session or chunk not found |
| 410 | Session expired (cleaned up) |

---

### GET /api/youtube/full/:sessionId

Stream the complete video (for non-chunked videos).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Session ID from download response |

**Example Request:**
```bash
curl "http://localhost:3001/api/youtube/full/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
- **Content-Type:** `video/mp4`
- **Body:** Binary video data (streamable)

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session not found |
| 410 | Session expired |

---

### GET /api/youtube/frame/:sessionId

Extract a single frame from the video at a specific timestamp.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Session ID from download response |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timestamp` | number | Yes | Time in seconds |

**Example Request:**
```bash
curl "http://localhost:3001/api/youtube/frame/550e8400-e29b-41d4-a716-446655440000?timestamp=120"
```

**Success Response (200):**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Missing or invalid timestamp |
| 404 | Session not found |
| 500 | Frame extraction failed |

---

### DELETE /api/youtube/session/:sessionId

Clean up a download session and its temporary files.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Session ID to clean up |

**Example Request:**
```bash
curl -X DELETE "http://localhost:3001/api/youtube/session/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Session cleaned up"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session not found |

---

## AI Endpoints

### POST /api/ai/vertex/analyze

Analyze video content using Google Vertex AI with inline base64 data (proxy endpoint).

**Request Body:**
```json
{
  "base64Data": "AAAAGGZ0eXBpc29tAAACAGlzb21pc28y...",
  "mimeType": "video/mp4",
  "projectId": "your-gcp-project-id",
  "location": "us-central1",
  "model": "gemini-3-pro-preview"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `base64Data` | string | Yes | Base64-encoded video data |
| `mimeType` | string | Yes | Video MIME type |
| `projectId` | string | No | Google Cloud project ID (optional, uses env var) |
| `location` | string | No | Vertex AI region (default: us-central1) |
| `model` | string | No | Model name (default: gemini-3-pro-preview) |

**Success Response (200):**
```json
{
  "segments": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces the main topic..."
    },
    {
      "timestamp": 180,
      "title": "Core Concepts",
      "markdown": "This section covers the fundamental concepts..."
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Missing required fields | Required parameters not provided |
| 401 | Authentication failed | Invalid or missing GCP credentials |
| 500 | Analysis failed | Vertex AI API error |

---

### POST /api/ai/vertex/gcs/upload

Upload a video to Google Cloud Storage for Vertex AI analysis. This is required for large videos that cannot be processed inline.

> **Note:** Files API does NOT work with Vertex AI. Use this GCS endpoint instead.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video` | file | Yes | Video file |
| `bucketName` | string | Yes | GCS bucket name |
| `projectId` | string | No | Google Cloud project ID |
| `location` | string | No | Vertex AI region |
| `model` | string | No | Model name |
| `videoDuration` | number | No | Total video duration in seconds (helps LLM generate valid timestamps) |

**Example Request:**
```bash
curl -X POST "http://localhost:3001/api/ai/vertex/gcs/upload" \
  -F "video=@video.mp4" \
  -F "bucketName=my-video-bucket" \
  -F "videoDuration=1800"
```

**Success Response (200):**
```json
{
  "gcsUri": "gs://my-video-bucket/videotonotion/session-id/1234567890.mp4",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | No video file uploaded | Missing video file |
| 400 | GCS bucket name is required | Missing bucket name |
| 500 | GCS credentials not found | Run `gcloud auth application-default login` |
| 500 | Permission denied | Check bucket IAM permissions |
| 500 | Bucket not found | Verify bucket name exists |

---

### POST /api/ai/vertex/gcs/analyze

Analyze a video that was uploaded to GCS.

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": "your-gcp-project-id",
  "location": "us-central1",
  "model": "gemini-3-pro-preview"
}
```

**Alternative (Direct GCS URI):**
```json
{
  "gcsUri": "gs://bucket/path/to/video.mp4",
  "mimeType": "video/mp4",
  "projectId": "your-gcp-project-id",
  "location": "us-central1"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Conditional | Session ID from upload response |
| `gcsUri` | string | Conditional | Direct GCS URI (if no sessionId) |
| `mimeType` | string | No | Video MIME type (required if using gcsUri) |
| `projectId` | string | No | Google Cloud project ID |
| `location` | string | No | Vertex AI region |
| `model` | string | No | Model name |
| `videoDuration` | number | No | Total video duration in seconds (helps LLM generate valid timestamps) |

**Success Response (200):**
```json
{
  "segments": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces the main topic..."
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | GCS URI or session ID required | Missing both identifiers |
| 404 | Session not found | Invalid session ID |
| 500 | Analysis failed | Vertex AI API error |
| 500 | Cannot access GCS file | Check file exists and permissions |

---

### DELETE /api/ai/vertex/gcs/:sessionId

Clean up a GCS upload session and delete the uploaded file.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Session ID from upload response |

**Example Request:**
```bash
curl -X DELETE "http://localhost:3001/api/ai/vertex/gcs/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session not found |

---

**Authentication Note:**

All Vertex AI and GCS endpoints require Google Cloud Application Default Credentials (ADC) to be configured on the server:

```bash
# One-time setup
gcloud auth application-default login
```

---

## Session Endpoints

Session endpoints manage video processing sessions and their notes. Data is persisted in SQLite database with images stored in the filesystem.

### GET /api/sessions

List all sessions with pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `pageSize` | number | No | 20 | Items per page (max 100) |

**Example Request:**
```bash
curl "http://localhost:3001/api/sessions?page=1&pageSize=10"
```

**Success Response (200):**
```json
{
  "sessions": [
    {
      "id": "abc123",
      "title": "Introduction to React Hooks",
      "url": "https://youtube.com/watch?v=...",
      "thumbnail": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
      "date": "2024-01-15T10:30:00.000Z",
      "status": 6,
      "noteCount": 5
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10
}
```

---

### GET /api/sessions/:id

Get a single session with all its notes.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session ID |

**Example Request:**
```bash
curl "http://localhost:3001/api/sessions/abc123"
```

**Success Response (200):**
```json
{
  "id": "abc123",
  "title": "Introduction to React Hooks",
  "url": "https://youtube.com/watch?v=...",
  "thumbnail": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
  "date": "2024-01-15T10:30:00.000Z",
  "status": 6,
  "notes": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces...",
      "imageUrl": "/api/sessions/abc123/notes/0/image"
    }
  ]
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session not found |

---

### POST /api/sessions

Create a new session.

**Request Body:**
```json
{
  "id": "abc123",
  "title": "Introduction to React Hooks",
  "url": "https://youtube.com/watch?v=...",
  "thumbnail": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
  "date": "2024-01-15T10:30:00.000Z",
  "status": 6,
  "notes": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces...",
      "image": "data:image/jpeg;base64,..."
    }
  ]
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique session ID |
| `title` | string | Yes | Video title |
| `date` | string | Yes | ISO date string |
| `url` | string | No | Video URL |
| `thumbnail` | string | No | Thumbnail URL |
| `status` | number | No | Processing status |
| `notes` | array | No | Note segments with images |

**Success Response (201):**
```json
{
  "id": "abc123",
  "title": "Introduction to React Hooks",
  "notes": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces...",
      "imageUrl": "/api/sessions/abc123/notes/0/image"
    }
  ]
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Missing required fields (id, title, date) |

---

### PUT /api/sessions/:id

Update an existing session.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session ID |

**Request Body:**
```json
{
  "title": "Updated Title",
  "status": 6
}
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session not found |

---

### DELETE /api/sessions/:id

Delete a session and all associated data (notes and images).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session ID |

**Example Request:**
```bash
curl -X DELETE "http://localhost:3001/api/sessions/abc123"
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session not found |

---

### POST /api/sessions/:id/notes

Save or replace notes for a session. Images are extracted from base64 data URLs and saved to the filesystem.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session ID |

**Request Body:**
```json
{
  "notes": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces...",
      "image": "data:image/jpeg;base64,..."
    },
    {
      "timestamp": 180,
      "title": "Core Concepts",
      "markdown": "This section covers...",
      "image": "data:image/jpeg;base64,..."
    }
  ]
}
```

**Success Response (200):**
```json
{
  "id": "abc123",
  "notes": [
    {
      "timestamp": 30,
      "title": "Introduction",
      "markdown": "The presenter introduces...",
      "imageUrl": "/api/sessions/abc123/notes/0/image"
    }
  ]
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Notes must be an array |
| 404 | Session not found |

---

### GET /api/sessions/:id/notes/:noteIndex/image

Get the image for a specific note.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session ID |
| `noteIndex` | number | Note index (0-based) |

**Example Request:**
```bash
curl "http://localhost:3001/api/sessions/abc123/notes/0/image"
```

**Success Response (200):**
- **Content-Type:** `image/jpeg`
- **Body:** Binary image data

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Session, note, or image not found |

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_URL` | 400 | URL format is invalid |
| `VIDEO_NOT_FOUND` | 404 | Video does not exist |
| `VIDEO_PRIVATE` | 403 | Video is private |
| `VIDEO_AGE_RESTRICTED` | 403 | Video requires age verification |
| `SESSION_NOT_FOUND` | 404 | Session ID not found |
| `SESSION_EXPIRED` | 410 | Session was cleaned up |
| `DOWNLOAD_FAILED` | 500 | yt-dlp download error |
| `CHUNK_FAILED` | 500 | ffmpeg chunking error |
| `FRAME_EXTRACTION_FAILED` | 500 | ffmpeg frame extraction error |
| `AI_AUTH_FAILED` | 401 | Google Cloud auth error |
| `AI_ANALYSIS_FAILED` | 500 | AI model error |

---

## Rate Limits & Quotas

### Server-Side Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Concurrent downloads | 5 | Per server instance |
| Session lifetime | 1 hour | Auto-cleanup after inactivity |
| Max video duration | 45 min | Gemini API limit (with audio) |

### External API Limits

| Service | Limit | Notes |
|---------|-------|-------|
| Gemini API | Varies | Based on your API key quota |
| Vertex AI | Varies | Based on GCP project quota |
| YouTube | N/A | yt-dlp handles rate limiting |

---

## TypeScript Types

### Request/Response Types

```typescript
// YouTube Download Response
interface DownloadResponse {
  sessionId: string;
  title: string;
  duration: number;
  chunks: ChunkInfo[];
}

interface ChunkInfo {
  id: number;
  startTime: number;
  endTime: number;
}

// Frame Extraction Response
interface FrameResponse {
  image: string; // data:image/jpeg;base64,...
}

// AI Analysis Response
interface AnalysisResponse {
  segments: NoteSegment[];
}

interface NoteSegment {
  timestamp: number;
  title: string;
  markdown: string;
}

// Error Response
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}
```

---

## Usage Examples

### Complete YouTube Processing Flow

```typescript
// 1. Start download
const downloadRes = await fetch('/api/youtube/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://youtube.com/watch?v=VIDEO_ID' })
});
const { sessionId, chunks, title } = await downloadRes.json();

// 2. Process each chunk
const allSegments = [];
for (const chunk of chunks) {
  // Fetch chunk
  const chunkRes = await fetch(`/api/youtube/chunk/${sessionId}/${chunk.id}`);
  const chunkBlob = await chunkRes.blob();

  // Convert to base64 and analyze
  const base64 = await blobToBase64(chunkBlob);
  const segments = await analyzeWithGemini(base64);

  // Adjust timestamps
  const adjusted = segments.map(s => ({
    ...s,
    timestamp: s.timestamp + chunk.startTime
  }));
  allSegments.push(...adjusted);
}

// 3. Extract frames
for (const segment of allSegments) {
  const frameRes = await fetch(
    `/api/youtube/frame/${sessionId}?timestamp=${segment.timestamp}`
  );
  const { image } = await frameRes.json();
  segment.image = image;
}

// 4. Cleanup
await fetch(`/api/youtube/session/${sessionId}`, { method: 'DELETE' });
```
