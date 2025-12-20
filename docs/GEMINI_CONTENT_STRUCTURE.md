# Gemini API Content Structure Guide

This guide documents the different ways to structure content for Google's Gemini API, including a critical bug discovery and best practices for video analysis.

## Table of Contents

- [Quick Reference](#quick-reference)
- [The Three Approaches](#the-three-approaches)
- [Type System Reference](#type-system-reference)
- [Known Issue: Timestamp Bug](#known-issue-timestamp-bug)
- [Vertex AI vs Gemini API](#vertex-ai-vs-gemini-api)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference

| Approach | Reliability | Use Case |
|----------|-------------|----------|
| **Canonical** (recommended) | Most reliable | Video analysis, multi-turn conversations |
| **Simplified** | Good | Simple single-turn requests |
| **Helper Functions** | May have edge cases | Quick prototyping |

**Recommended structure for video analysis:**

```typescript
const contents = [
  {
    role: 'user',
    parts: [
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: 'gs://bucket/video.mp4',
        }
      },
      {
        text: 'Analyze this video',
      }
    ]
  }
];
```

---

## The Three Approaches

### 1. Canonical Approach (Recommended)

The canonical approach uses the full `Content` structure with explicit `role` and `parts`. This is the most reliable method and matches the REST API documentation exactly.

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: 'my-project',
  location: 'us-central1',
});

// Canonical structure - explicit role and parts
const contents = [
  {
    role: 'user',
    parts: [
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: 'gs://my-bucket/video.mp4',
        }
      },
      {
        text: 'What happens in this video?',
      }
    ]
  }
];

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents,
});
```

**When to use:**
- Video analysis (timestamps are more accurate)
- Multi-turn conversations
- Function calls and responses
- When you need explicit control over roles

**Advantages:**
- Most reliable for video analysis
- Works identically in Gemini API and Vertex AI
- No reliance on SDK auto-conversion
- Easier to debug
- Matches REST API documentation exactly

### 2. Simplified Approach

The simplified approach uses an array of `Part` objects. The SDK automatically wraps this into a `Content` object with `role: 'user'`.

```typescript
import { GoogleGenAI, ContentListUnion } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: 'my-project',
  location: 'us-central1',
});

// Simplified structure - array of parts
const contents: ContentListUnion = [
  {
    inlineData: {
      mimeType: 'video/mp4',
      data: base64VideoData,
    },
  },
  {
    text: 'Analyze this video',
  },
];

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents,
});
```

**When to use:**
- Simple single-turn requests
- Inline data (base64)
- When code brevity is prioritized

**How SDK handles it:**
The SDK internally converts this to:
```typescript
{
  role: 'user',
  parts: [
    { inlineData: { mimeType, data } },
    { text: 'Analyze this video' }
  ]
}
```

### 3. Helper Functions Approach

The SDK provides helper functions like `createUserContent` and `createPartFromUri` for convenience.

```typescript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: 'my-project',
  location: 'us-central1',
});

// Helper functions approach
const contents = createUserContent([
  createPartFromUri('gs://my-bucket/video.mp4', 'video/mp4'),
  'Analyze this video',
]);

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents,
});
```

**Helper function definitions:**

```typescript
// Creates a Content object with role 'user'
function createUserContent(partOrString: PartListUnion | string): Content {
  return {
    role: 'user',
    parts: _toParts(partOrString),
  };
}

// Creates a Part object from a URI
function createPartFromUri(uri: string, mimeType: string, mediaResolution?: PartMediaResolutionLevel): Part {
    return Object.assign({ fileData: {
            fileUri: uri,
            mimeType: mimeType,
        } }, (mediaResolution && { mediaResolution: { level: mediaResolution } }));
}
```

**When to use:**
- Quick prototyping
- Simple text prompts
- When you don't need precise control

**WARNING:** See [Known Issue: Timestamp Bug](#known-issue-timestamp-bug) for potential issues with video analysis.

---

## Type System Reference

### ContentListUnion

The SDK's flexible type that accepts multiple content formats:

```typescript
type ContentListUnion = Content | Content[] | PartUnion | PartUnion[];
```

This means `contents` can be:
- A single `Content` object
- An array of `Content` objects
- A single `Part` or string
- An array of `Part` objects or strings

### Content Interface

```typescript
interface Content {
  /** List of parts that constitute a single message. */
  parts?: Part[];

  /** The producer of the content. Must be 'user' or 'model'. */
  role?: string;
}
```

### Part Interface

A `Part` contains exactly one of these fields:

```typescript
interface Part {
  /** Text content */
  text?: string;

  /** Inline base64-encoded data */
  inlineData?: {
    mimeType: string;
    data: string;  // base64-encoded
    displayName?: string;
  };

  /** File reference by URI */
  fileData?: {
    mimeType: string;
    fileUri: string;
    displayName?: string;
  };

  /** Function call (model response) */
  functionCall?: FunctionCall;

  /** Function response (user provides) */
  functionResponse?: FunctionResponse;

  /** Video metadata (optional) */
  videoMetadata?: {
    startOffset?: string;
    endOffset?: string; 
    fps?: number;  // The frame rate of the video sent to the model. If not specified, the default value will be 1.0. The fps range is (0.0, 24.0].
  };
}
```

### Why ContentListUnion Doesn't Support `role`

`ContentListUnion` is a union of four types:

```
ContentListUnion = Content | Content[] | PartUnion | PartUnion[]
                     ↓         ↓           ↓           ↓
                 Has role   Has role   No role     No role
```

TypeScript only allows access to properties common to ALL union members. Since `PartUnion` doesn't have `role`, you cannot access `role` directly on `ContentListUnion`.

**Correct approach:**
```typescript
// Option 1: Explicit Content type
const contents: Content[] = [{
  role: 'user',
  parts: [{ text: 'Hello' }]
}];

// Option 2: Type assertion
const content = contents as Content;
console.log(content.role);
```

---

## Known Issue: Timestamp Bug

### The Problem

When using `createUserContent` with video files for analysis that requires timestamps, the model may return timestamps that exceed the video duration.

**Problematic code:**
```typescript
// This approach may produce incorrect timestamps
const contents = createUserContent([
  createPartFromUri(gcsUri, 'video/mp4'),
  'Extract timestamps from this video',
]);
```

### The Solution

Use the canonical structure with explicit `role` and `parts`:

```typescript
// This approach produces correct timestamps
const contents = [
  {
    role: 'user',
    parts: [
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: gcsUri,
        }
      },
      {
        text: 'Extract timestamps from this video',
      }
    ]
  }
];
```

### Related Gemini Timestamp Issues

Known timestamp issues in Gemini models (from GitHub research):

| Issue | Model | Problem |
|-------|-------|---------|
| [#269](https://github.com/google-gemini/generative-ai-js/issues/269) | Gemini 1.5 Flash 002 | Hallucinates timestamps during transcription |
| [#426](https://github.com/google-gemini/deprecated-generative-ai-js/issues/426) | Gemini 2.0 Flash/Lite | Hallucinates timestamps for audio |
| [#1359](https://github.com/googleapis/python-genai/issues/1359) | Gemini 2.5 Pro/Flash | Inaccurate YouTube URL timestamps |

**Model limitations:**
- Video sampling: 1 frame per second
- Timestamp precision: Second-level only (MM:SS)
- Fast action sequences may lose detail

### Workarounds

1. **Use canonical structure** - Most effective fix
2. **Include video duration in prompt:**
   ```typescript
   {
     text: `IMPORTANT: Video duration is ${duration} seconds.
            All timestamps must be between 0 and ${duration}.
            Analyze this video...`
   }
   ```
3. **Post-process validation** - Filter timestamps exceeding duration
4. **Download YouTube videos** - Direct uploads are more accurate than YouTube URLs

---

## Vertex AI vs Gemini API

### Key Differences

| Feature | Gemini API | Vertex AI |
|---------|-----------|-----------|
| **Authentication** | API Key | ADC / OAuth |
| **Files API** | Supported (up to 2GB) | Not supported |
| **GCS Bucket** | Not supported | Required for large files |
| **File URI Format** | `https://...` (Files API) | `gs://...` (GCS) |
| **Max inline size** | 20MB | 20MB |
| **Enterprise features** | Limited | Full (SLA, VPC, etc.) |

### File Handling Strategies

**Gemini API (with API Key):**
```typescript
// Use Files API for large videos
const uploadedFile = await ai.files.upload({
  file: fs.createReadStream('./video.mp4'),
  config: { mimeType: 'video/mp4' }
});

// Poll until ready
while (uploadedFile.state !== 'ACTIVE') {
  await new Promise(r => setTimeout(r, 5000));
  uploadedFile = await ai.files.get({ name: uploadedFile.name });
}

// Use Files API URI
const contents = [{
  role: 'user',
  parts: [
    { fileData: { mimeType: 'video/mp4', fileUri: uploadedFile.uri } },
    { text: 'Analyze this video' }
  ]
}];
```

**Vertex AI (with ADC):**
```typescript
import { Storage } from '@google-cloud/storage';

// Upload to GCS bucket
const storage = new Storage();
await storage.bucket('my-bucket').upload('./video.mp4', {
  destination: 'videos/video.mp4',
  resumable: true,
});

// Use GCS URI (no polling needed)
const contents = [{
  role: 'user',
  parts: [
    { fileData: { mimeType: 'video/mp4', fileUri: 'gs://my-bucket/videos/video.mp4' } },
    { text: 'Analyze this video' }
  ]
}];
```

### SDK Initialization

```typescript
// Gemini API
const ai = new GoogleGenAI({
  apiKey: 'YOUR_API_KEY',
});

// Vertex AI
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
});
```

**Important:** The `vertexai: true` parameter only changes backend routing and authentication. Content structure remains identical.

---

## Best Practices

### For Video Analysis

1. **Always use canonical structure**
   ```typescript
   const contents = [{
     role: 'user',
     parts: [
       { fileData: { mimeType, fileUri } },
       { text: prompt }
     ]
   }];
   ```

2. **Include video duration in prompt**
   ```typescript
   const prompt = `
     Video duration: ${duration} seconds.
     Valid timestamp range: 0 to ${duration}.
     Do NOT generate timestamps exceeding ${duration}.

     Analyze this video...
   `;
   ```

3. **Validate returned timestamps**
   ```typescript
   const validSegments = segments.filter(s =>
     s.timestamp >= 0 && s.timestamp <= duration
   );
   ```

4. **Order parts correctly**
   - Place video/media before text prompt
   - This helps the model understand context

### For Multi-turn Conversations

```typescript
const contents = [
  { role: 'user', parts: [{ text: 'What is AI?' }] },
  { role: 'model', parts: [{ text: 'AI is...' }] },
  { role: 'user', parts: [{ text: 'Tell me more' }] },
];
```

### For Function Calls

```typescript
const contents = [
  { role: 'user', parts: [{ text: 'Calculate 2+2' }] },
  { role: 'model', parts: [{ functionCall: { name: 'calculate', args: { expr: '2+2' } } }] },
  { role: 'user', parts: [{ functionResponse: { name: 'calculate', response: { result: 4 } } }] },
];
```

### General Guidelines

1. **Validate MIME types** - Ensure they match actual content
2. **Use appropriate file strategy**:
   - Inline data: Files < 20MB
   - Files API: Large files with Gemini API
   - GCS bucket: Large files with Vertex AI
3. **Handle file expiration** - Files API files auto-delete after 48 hours
4. **Set appropriate timeouts** - Video processing can take time

---

## Troubleshooting

### Timestamps Exceed Video Duration

**Problem:** AI returns timestamps like `120.5` for a 60-second video.

**Solutions:**
1. Use canonical content structure (see [Known Issue](#known-issue-timestamp-bug))
2. Add duration constraints to prompt
3. Post-process to filter invalid timestamps

### "Files API not supported" Error

**Problem:** Getting errors when using Files API with Vertex AI.

**Solution:** Files API only works with Gemini API (API key). For Vertex AI, upload to GCS bucket and use `gs://` URIs.

### "PERMISSION_DENIED" for GCS

**Problem:** Cannot access GCS file from Vertex AI.

**Solutions:**
1. Ensure bucket is in same GCP project
2. Grant `storage.objects.get` permission
3. Make file publicly readable (if appropriate)

### Role Property Type Error

**Problem:** TypeScript error when accessing `role` on `ContentListUnion`.

**Solution:** Use explicit `Content[]` type:
```typescript
const contents: Content[] = [{
  role: 'user',
  parts: [{ text: 'Hello' }]
}];
```

### Video Not Processing

**Problem:** Video analysis returns empty or incorrect results.

**Solutions:**
1. Verify MIME type is correct
2. Check file size limits (20MB inline, 2GB via URI)
3. For Files API, ensure polling until `state === 'ACTIVE'`
4. Try downloading and re-uploading the video

---

## References

### Official Documentation

- [Gemini API Content Reference](https://ai.google.dev/api/generate-content)
- [Vertex AI Inference API](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference)
- [Video Understanding Guide](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Files API Guide](https://ai.google.dev/gemini-api/docs/files)

### SDK Resources

- [@google/genai npm package](https://www.npmjs.com/package/@google/genai)
- [js-genai GitHub repository](https://github.com/googleapis/js-genai)
- [SDK Migration Guide](https://ai.google.dev/gemini-api/docs/migrate)

### Known Issues

- [Gemini 1.5 Flash 002 timestamp hallucination](https://github.com/google-gemini/generative-ai-js/issues/269)
- [Gemini 2.0 Flash timestamp issues](https://github.com/google-gemini/deprecated-generative-ai-js/issues/426)
- [YouTube URL timestamp accuracy](https://github.com/googleapis/python-genai/issues/1359)
