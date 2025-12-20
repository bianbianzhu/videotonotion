# Vertex AI with GCS Bucket

Use this reference when using **Vertex AI** (not direct Gemini API key). Files API does NOT work with Vertex AI - use GCS bucket instead.

> **Important**: For video analysis requiring timestamps, use the canonical content structure (with explicit `role` and `parts`) instead of helper functions like `createUserContent`. See [Known Issues](#known-issues) for details.

## Quick Start

```typescript
import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";

// 1. Upload to GCS
const storage = new Storage();
await storage.bucket("my-bucket").upload("./video.mp4", {
  destination: "videos/my-video.mp4",
  resumable: true,
});
const gcsUri = "gs://my-bucket/videos/my-video.mp4";

// 2. Analyze with Vertex AI (no polling needed)
const ai = new GoogleGenAI({
  vertexai: true,
  project: "my-project",
  location: "us-central1",
});

// Use canonical structure for reliable video analysis
const response = await ai.models.generateContent({
  model: "gemini-3-pro-preview",
  contents: [
    {
      role: "user",
      parts: [
        {
          fileData: {
            mimeType: "video/mp4",
            fileUri: gcsUri,
          },
        },
        {
          text: "Describe this video",
        },
      ],
    },
  ],
});
```

## Environment Setup

```bash
# Authenticate with Google Cloud
gcloud auth application-default login

# Set project
export VERTEX_AI_PROJECT_ID="your-project"
export VERTEX_AI_LOCATION="us-central1"
export GCS_BUCKET_NAME="your-bucket"
```

```bash
npm install @google/genai @google-cloud/storage
```

## GCS Service

```typescript
import { Storage } from "@google-cloud/storage";
import path from "path";

const storage = new Storage();

/**
 * Upload a video file to Google Cloud Storage.
 */
export async function uploadToGcs(
  filePath: string,
  bucketName: string,
  destinationName: string
): Promise<string> {
  const bucket = storage.bucket(bucketName);

  await bucket.upload(filePath, {
    destination: destinationName,
    resumable: true,
    metadata: {
      contentType: getMimeTypeFromPath(filePath),
    },
  });

  return `gs://${bucketName}/${destinationName}`;
}

/**
 * Delete a file from Google Cloud Storage.
 */
export async function deleteFromGcs(
  bucketName: string,
  objectName: string
): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);

  try {
    await file.delete();
  } catch (error: any) {
    if (error.code !== 404) throw error; // Ignore 404
  }
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
  };
  return mimeTypes[ext] || "video/mp4";
}
```

## Vertex AI Analysis with GCS

```typescript
import { GoogleGenAI } from "@google/genai";

export async function analyzeVideoWithGcs(
  gcsUri: string,
  mimeType: string,
  prompt: string,
  options?: {
    projectId?: string;
    location?: string;
    model?: string;
  }
): Promise<string> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: options?.projectId || process.env.VERTEX_AI_PROJECT_ID,
    location: options?.location || process.env.VERTEX_AI_LOCATION || "us-central1",
  });

  // Use canonical structure for reliable timestamp extraction
  const contents = [
    {
      role: "user",
      parts: [
        {
          fileData: {
            mimeType,
            fileUri: gcsUri,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: options?.model || "gemini-3-pro-preview",
    contents,
  });

  return response.text ?? "";
}
```

## Complete Video Analyzer Class

```typescript
import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import path from "path";

interface AnalyzeOptions {
  model?: string;
  deleteAfterAnalysis?: boolean;
}

const DEFAULT_OPTIONS = {
  model: "gemini-3-pro-preview",
  deleteAfterAnalysis: false,
};

export class VertexVideoAnalyzer {
  private ai: GoogleGenAI;
  private storage: Storage;
  private bucketName: string;

  constructor(
    projectId: string,
    location: string,
    bucketName: string
  ) {
    this.ai = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location,
    });
    this.storage = new Storage();
    this.bucketName = bucketName;
  }

  async upload(filePath: string, objectName?: string): Promise<string> {
    const destination = objectName || `videos/${Date.now()}${path.extname(filePath)}`;
    const bucket = this.storage.bucket(this.bucketName);

    await bucket.upload(filePath, {
      destination,
      resumable: true,
    });

    return `gs://${this.bucketName}/${destination}`;
  }

  async analyze(
    gcsUri: string,
    mimeType: string,
    prompt: string,
    options: Partial<AnalyzeOptions> = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Use canonical structure for reliable video analysis
    const contents = [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType,
              fileUri: gcsUri,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ];

    const response = await this.ai.models.generateContent({
      model: opts.model,
      contents,
    });

    if (opts.deleteAfterAnalysis) {
      const objectName = gcsUri.replace(`gs://${this.bucketName}/`, "");
      await this.delete(objectName);
    }

    return response.text ?? "";
  }

  async processVideo(
    filePath: string,
    prompt: string,
    options: Partial<AnalyzeOptions> = {}
  ): Promise<string> {
    const mimeType = this.getMimeType(filePath);
    const gcsUri = await this.upload(filePath);
    return this.analyze(gcsUri, mimeType, prompt, options);
  }

  async delete(objectName: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    try {
      await bucket.file(objectName).delete();
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const types: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
    };
    return types[ext] || "video/mp4";
  }
}
```

## Usage Examples

### Basic Usage

```typescript
const analyzer = new VertexVideoAnalyzer(
  "my-project",
  "us-central1",
  "my-bucket"
);

const result = await analyzer.processVideo(
  "./video.mp4",
  "What happens in this video?"
);
```

### With Cleanup

```typescript
const analyzer = new VertexVideoAnalyzer(
  process.env.VERTEX_AI_PROJECT_ID!,
  process.env.VERTEX_AI_LOCATION!,
  process.env.GCS_BUCKET_NAME!
);

const result = await analyzer.processVideo(
  "./video.mp4",
  "Summarize this video",
  { deleteAfterAnalysis: true }
);
```

### Express.js Integration

```typescript
import express from "express";
import multer from "multer";
import { uploadToGcs, deleteFromGcs } from "./gcsService";
import { analyzeVideoWithGcs } from "./aiService";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/analyze", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video" });

  const bucketName = process.env.GCS_BUCKET_NAME!;
  const objectName = `videos/${Date.now()}-${req.file.originalname}`;

  try {
    // Upload to GCS
    const gcsUri = await uploadToGcs(req.file.path, bucketName, objectName);

    // Analyze with Vertex AI
    const result = await analyzeVideoWithGcs(
      gcsUri,
      req.file.mimetype,
      req.body.prompt || "Describe this video"
    );

    // Cleanup
    await deleteFromGcs(bucketName, objectName);

    res.json({ analysis: result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
```

## Key Differences from Files API

| Aspect | Files API (Gemini) | GCS (Vertex AI) |
|--------|-------------------|------------------|
| Provider | Gemini API only | Vertex AI only |
| Polling | Required (wait for ACTIVE) | Not needed |
| Backend | No backend required | Requires GCS bucket |
| Max Size | 2 GB | Unlimited |
| Retention | 48 hours auto-delete | Manual cleanup |
| URI Format | `files://...` | `gs://bucket/path` |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `PERMISSION_DENIED` | Missing GCS permissions | Grant `storage.objects.create` role |
| `NOT_FOUND` | Bucket doesn't exist | Create bucket first |
| `INVALID_ARGUMENT` | Invalid `gs://` URI | Check URI format |
| `Vertex AI auth failed` | ADC not configured | Run `gcloud auth application-default login` |

## Known Issues

### Timestamps Outside Video Duration

**Problem:** When using helper functions like `createUserContent` and `createPartFromUri` for video analysis that requires timestamps, the model may return timestamps that exceed the actual video duration.

**Example of problematic code:**
```typescript
// DO NOT use for timestamp-sensitive video analysis
const contents = createUserContent([
  createPartFromUri(gcsUri, "video/mp4"),
  "Extract timestamps from this video",
]);
```

**Solution:** Use the canonical content structure with explicit `role` and `parts`:
```typescript
// RECOMMENDED for video analysis
const contents = [
  {
    role: "user",
    parts: [
      {
        fileData: {
          mimeType: "video/mp4",
          fileUri: gcsUri,
        },
      },
      {
        text: "Extract timestamps from this video",
      },
    ],
  },
];
```

### Related Gemini Timestamp Issues

Gemini models have documented timestamp hallucination issues:

| Issue | Model | Problem |
|-------|-------|---------|
| [#269](https://github.com/google-gemini/generative-ai-js/issues/269) | Gemini 1.5 Flash 002 | Hallucinates timestamps during transcription |
| [#426](https://github.com/google-gemini/deprecated-generative-ai-js/issues/426) | Gemini 2.0 Flash/Lite | Hallucinates timestamps for audio |
| [#1359](https://github.com/googleapis/python-genai/issues/1359) | Gemini 2.5 Pro/Flash | Inaccurate YouTube URL timestamps |

### Best Practices for Timestamp Accuracy

1. **Always use canonical content structure** for video analysis
2. **Include video duration in prompt:**
   ```typescript
   const prompt = `
     Video duration: ${duration} seconds.
     Valid timestamp range: 0 to ${duration}.
     Do NOT generate timestamps exceeding ${duration}.

     Analyze this video...
   `;
   ```
3. **Validate returned timestamps** and filter those exceeding duration
4. **Download YouTube videos** rather than using URLs directly

See `docs/GEMINI_CONTENT_STRUCTURE.md` for comprehensive documentation.

## Official Documentation

- **Vertex AI Gemini**: https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding
- **Google Cloud Storage**: https://cloud.google.com/storage/docs
- **GCS Node.js Client**: https://cloud.google.com/nodejs/docs/reference/storage/latest
- **Application Default Credentials**: https://cloud.google.com/docs/authentication/application-default-credentials
