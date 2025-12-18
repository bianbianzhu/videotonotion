---
name: gemini-video-upload
description: Guide for uploading and analyzing large videos with Gemini/Vertex AI. Use this skill when implementing video analysis, handling large video files (over 20MB), or working with the @google/genai SDK. Supports two strategies: (1) Files API for Gemini API key users, (2) GCS bucket for Vertex AI users. Files API does NOT work with Vertex AI.
---

# Gemini Video Upload Skill

Upload and analyze large videos using the `@google/genai` SDK. Two strategies available depending on your provider.

## Strategy Selection

| Provider | Strategy | Reference |
|----------|----------|-----------|
| **Gemini API key** | Files API | [gemini-files-api.md](references/gemini-files-api.md) |
| **Vertex AI** | GCS Bucket | [vertex-gcs.md](references/vertex-gcs.md) |

**Files API does NOT work with Vertex AI.** Use GCS bucket strategy instead.

## Quick Comparison

| Aspect | Files API (Gemini) | GCS (Vertex AI) |
|--------|-------------------|------------------|
| Provider | Gemini API key only | Vertex AI only |
| Max Size | 2 GB | Unlimited |
| Polling | Required (wait for ACTIVE) | Not needed |
| Backend | No backend required | Requires GCS bucket |
| Retention | 48 hours auto-delete | Manual cleanup |
| Package | `@google/genai` | `@google/genai` + `@google-cloud/storage` |

## Quick Start: Files API (Gemini API Key)

```typescript
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

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
  model: "gemini-3-pro-preview",
  contents: createUserContent([createPartFromUri(file.uri, file.mimeType), "Describe this video"]),
});
```

See [gemini-files-api.md](references/gemini-files-api.md) for complete patterns.

## Quick Start: GCS Bucket (Vertex AI)

```typescript
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { Storage } from "@google-cloud/storage";

// Upload to GCS
const storage = new Storage();
await storage.bucket("my-bucket").upload("./video.mp4", { destination: "videos/my-video.mp4" });
const gcsUri = "gs://my-bucket/videos/my-video.mp4";

// Analyze with Vertex AI (no polling)
const ai = new GoogleGenAI({ vertexai: true, project: "my-project", location: "us-central1" });

const response = await ai.models.generateContent({
  model: "gemini-3-pro-preview",
  contents: createUserContent([createPartFromUri(gcsUri, "video/mp4"), "Describe this video"]),
});
```

See [vertex-gcs.md](references/vertex-gcs.md) for complete patterns.

## When to Use Large Video Upload

Use these strategies when:
- File size > 20MB
- Video duration > ~1 minute
- Reusing the same video across multiple requests

For smaller videos, inline base64 encoding works fine.

## Supported Video Formats

| MIME Type | Extension |
|-----------|-----------|
| video/mp4 | .mp4 |
| video/webm | .webm |
| video/quicktime | .mov |
| video/x-msvideo | .avi |
| video/x-matroska | .mkv |

## Package Installation

```bash
# For Gemini API key (Files API)
npm install @google/genai

# For Vertex AI (GCS)
npm install @google/genai @google-cloud/storage
```
