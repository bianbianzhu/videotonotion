---
name: gemini-video-upload
description: Guide for uploading and analyzing videos with the Gemini API using the Files API in JavaScript/TypeScript. Use this skill when implementing video analysis with Gemini, handling large video files (over 20MB), building video processing agents, or working with the @google/genai SDK's Files API for video content.
---

# Gemini Video Upload Skill

Upload and analyze videos using Gemini's Files API with the official `@google/genai` SDK.

## When to Use the Files API

Always use the Files API for videos when:

- File size > 20MB
- Video duration > ~1 minute
- Reusing the same video across multiple requests

## Quick Start

```typescript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Upload → Wait for processing → Analyze
let file = await ai.files.upload({
  file: "path/to/video.mp4",
  config: { mimeType: "video/mp4" },
});

// Poll until ACTIVE (required for videos)
while (!file.state || file.state.toString() !== "ACTIVE") {
  await new Promise((r) => setTimeout(r, 5000));
  file = await ai.files.get({ name: file.name });
}

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(file.uri, file.mimeType),
    "Describe this video",
  ]),
});
console.log(response.text);
```

## Core Workflow

```
1. Upload video     → ai.files.upload()
2. Poll for ACTIVE  → ai.files.get() in loop until state === "ACTIVE"
3. Generate content → ai.models.generateContent() with file reference
4. (Optional) Delete file → ai.files.delete()
```

## Implementation Patterns

See [references/patterns.md](references/patterns.md) for production-ready patterns:

- Complete `GeminiVideoAnalyzer` class with TypeScript types
- Error handling with retries and exponential backoff
- Timeout management for large files
- File cleanup utilities
- Streaming responses

See [references/sources.md](references/sources.md) for official documentation links and references.

### Key API Methods

```typescript
// Upload
const file = await ai.files.upload({
  file: string | Blob, // File path or Blob
  config: {
    mimeType: string, // Required: "video/mp4", "video/webm", etc.
    displayName: string, // Optional: human-readable name
  },
});

// Get file metadata (for polling)
const file = await ai.files.get({ name: file.name });

// List uploaded files
const files = await ai.files.list({ config: { pageSize: 10 } });

// Delete file
await ai.files.delete({ name: file.name });
```

### File State Handling

Videos require processing after upload. **Always poll before use:**

```typescript
async function waitForActive(
  ai: GoogleGenAI,
  fileName: string,
  timeoutMs = 300000, // 5 min default
  intervalMs = 5000
): Promise<File> {
  const start = Date.now();
  let file = await ai.files.get({ name: fileName });

  while (file.state?.toString() !== "ACTIVE") {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timeout waiting for file ${fileName}`);
    }
    if (file.state?.toString() === "FAILED") {
      throw new Error(`File processing failed: ${fileName}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    file = await ai.files.get({ name: fileName });
  }
  return file;
}
```

### Supported Video Formats

| MIME Type        | Extension |
| ---------------- | --------- |
| video/mp4        | .mp4      |
| video/webm       | .webm     |
| video/quicktime  | .mov      |
| video/x-msvideo  | .avi      |
| video/x-matroska | .mkv      |
| video/3gpp       | .3gp      |

## Files API Limits

- **Per-project storage**: 20 GB
- **Per-file max size**: 2 GB
- **File retention**: 48 hours (auto-deleted)
- **Cost**: Free in all Gemini API regions

## Configuration

### Environment Setup

```bash
# Required
export GEMINI_API_KEY="your-api-key"

# Optional (for Vertex AI)
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="your-project"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

### Package Installation

```bash
npm install @google/genai
# or
pnpm add @google/genai
```

## Error Handling

Common errors and solutions:

| Error                                           | Cause                                | Solution                               |
| ----------------------------------------------- | ------------------------------------ | -------------------------------------- |
| `FAILED_PRECONDITION: file not in active state` | Used file before processing complete | Poll until `state === "ACTIVE"`        |
| `INVALID_ARGUMENT: unsupported MIME type`       | Wrong mimeType                       | Use correct MIME type for video format |
| `RESOURCE_EXHAUSTED`                            | Rate limited                         | Implement exponential backoff          |
| Processing stuck at `PROCESSING`                | Server issue or corrupt file         | Retry upload or check file integrity   |

## Best Practices

1. **Always poll for ACTIVE state** - Videos need server-side processing
2. **Set reasonable timeouts** - Large videos take longer to process
3. **Clean up after use** - Delete files when done to manage storage
4. **Handle errors gracefully** - Implement retries for transient failures
5. **Use displayName** - Helps identify files in list operations
6. **Check file.state before use** - Never assume upload completion means ready

## Example Prompts for Video Analysis

```typescript
const prompts = {
  summarize: "Summarize this video in 3-5 sentences.",
  transcript: "Transcribe all spoken content with timestamps.",
  quiz: "Create a 5-question quiz based on this video.",
  keyMoments: "Identify and describe the key moments with timestamps.",
  sentiment: "Analyze the overall sentiment and tone of this video.",
  objects: "List all objects and people visible in this video.",
};
```
