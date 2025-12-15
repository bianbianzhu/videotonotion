# Gemini Video Upload Patterns

Production-ready patterns for video analysis with the Gemini API.

## Complete Video Analyzer Class

```typescript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
  type GenerateContentResponse,
} from "@google/genai";

interface VideoFile {
  name: string;
  uri: string;
  mimeType: string;
  state: string;
  displayName?: string;
  sizeBytes?: string;
  createTime?: string;
  expirationTime?: string;
}

interface AnalyzeOptions {
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  deleteAfterAnalysis?: boolean;
}

interface UploadOptions {
  mimeType: string;
  displayName?: string;
}

const DEFAULT_OPTIONS: Required<AnalyzeOptions> = {
  model: "gemini-2.5-flash",
  timeoutMs: 300000, // 5 minutes
  pollIntervalMs: 5000, // 5 seconds
  deleteAfterAnalysis: false,
};

export class GeminiVideoAnalyzer {
  private ai: GoogleGenAI;

  constructor(apiKey?: string) {
    this.ai = new GoogleGenAI({
      apiKey: apiKey ?? process.env.GEMINI_API_KEY,
    });
  }

  /**
   * Upload a video file to Gemini Files API
   */
  async upload(filePath: string, options: UploadOptions): Promise<VideoFile> {
    const file = await this.ai.files.upload({
      file: filePath,
      config: {
        mimeType: options.mimeType,
        displayName: options.displayName,
      },
    });

    return file as VideoFile;
  }

  /**
   * Wait for a file to reach ACTIVE state
   */
  async waitForActive(
    fileName: string,
    timeoutMs = DEFAULT_OPTIONS.timeoutMs,
    pollIntervalMs = DEFAULT_OPTIONS.pollIntervalMs
  ): Promise<VideoFile> {
    const startTime = Date.now();
    let file = (await this.ai.files.get({ name: fileName })) as VideoFile;

    while (file.state !== "ACTIVE") {
      // Check for timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Timeout after ${timeoutMs}ms waiting for file "${fileName}" to become ACTIVE. ` +
            `Current state: ${file.state}`
        );
      }

      // Check for failure
      if (file.state === "FAILED") {
        throw new Error(
          `File "${fileName}" failed to process. This may indicate a corrupt or unsupported file.`
        );
      }

      // Log progress
      console.log(`File state: ${file.state}, waiting ${pollIntervalMs}ms...`);

      // Wait and poll again
      await this.sleep(pollIntervalMs);
      file = (await this.ai.files.get({ name: fileName })) as VideoFile;
    }

    return file;
  }

  /**
   * Upload and wait for processing to complete
   */
  async uploadAndWait(
    filePath: string,
    options: UploadOptions & { timeoutMs?: number; pollIntervalMs?: number }
  ): Promise<VideoFile> {
    const file = await this.upload(filePath, options);
    return this.waitForActive(
      file.name,
      options.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
      options.pollIntervalMs ?? DEFAULT_OPTIONS.pollIntervalMs
    );
  }

  /**
   * Analyze a video with a prompt
   */
  async analyze(
    file: VideoFile,
    prompt: string,
    options: Partial<AnalyzeOptions> = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const response = await this.ai.models.generateContent({
      model: opts.model,
      contents: createUserContent([
        createPartFromUri(file.uri, file.mimeType),
        prompt,
      ]),
    });

    if (opts.deleteAfterAnalysis) {
      await this.delete(file.name);
    }

    return response.text ?? "";
  }

  /**
   * Analyze with streaming response
   */
  async *analyzeStream(
    file: VideoFile,
    prompt: string,
    model = DEFAULT_OPTIONS.model
  ): AsyncGenerator<string> {
    const response = await this.ai.models.generateContentStream({
      model,
      contents: createUserContent([
        createPartFromUri(file.uri, file.mimeType),
        prompt,
      ]),
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  /**
   * Complete workflow: upload, wait, analyze
   */
  async processVideo(
    filePath: string,
    prompt: string,
    uploadOptions: UploadOptions,
    analyzeOptions: Partial<AnalyzeOptions> = {}
  ): Promise<string> {
    const file = await this.uploadAndWait(filePath, {
      ...uploadOptions,
      timeoutMs: analyzeOptions.timeoutMs,
      pollIntervalMs: analyzeOptions.pollIntervalMs,
    });

    return this.analyze(file, prompt, analyzeOptions);
  }

  /**
   * Delete a file from the Files API
   */
  async delete(fileName: string): Promise<void> {
    await this.ai.files.delete({ name: fileName });
  }

  /**
   * List all uploaded files
   */
  async listFiles(pageSize = 100): Promise<VideoFile[]> {
    const files: VideoFile[] = [];
    const response = await this.ai.files.list({ config: { pageSize } });

    for await (const file of response) {
      files.push(file as VideoFile);
    }

    return files;
  }

  /**
   * Delete all uploaded files (cleanup utility)
   */
  async deleteAll(): Promise<number> {
    const files = await this.listFiles();
    let deleted = 0;

    for (const file of files) {
      try {
        await this.delete(file.name);
        deleted++;
      } catch (error) {
        console.warn(`Failed to delete ${file.name}:`, error);
      }
    }

    return deleted;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## Usage Examples

### Basic Usage

```typescript
const analyzer = new GeminiVideoAnalyzer();

const result = await analyzer.processVideo(
  "./video.mp4",
  "What happens in this video?",
  { mimeType: "video/mp4" }
);

console.log(result);
```

### With Custom Options

```typescript
const analyzer = new GeminiVideoAnalyzer(process.env.MY_API_KEY);

const result = await analyzer.processVideo(
  "./long-video.mp4",
  "Create a detailed summary with timestamps",
  { mimeType: "video/mp4", displayName: "Meeting Recording" },
  {
    model: "gemini-2.5-pro",
    timeoutMs: 600000, // 10 minutes for large files
    deleteAfterAnalysis: true,
  }
);
```

### Streaming Response

```typescript
const analyzer = new GeminiVideoAnalyzer();
const file = await analyzer.uploadAndWait("./video.mp4", {
  mimeType: "video/mp4",
});

for await (const chunk of analyzer.analyzeStream(file, "Describe this video")) {
  process.stdout.write(chunk);
}
```

### Batch Processing

```typescript
const analyzer = new GeminiVideoAnalyzer();

const videos = [
  { path: "./video1.mp4", prompt: "Summarize this" },
  { path: "./video2.mp4", prompt: "List key points" },
];

const results = await Promise.all(
  videos.map((v) =>
    analyzer.processVideo(v.path, v.prompt, { mimeType: "video/mp4" })
  )
);
```

### Reusing Uploaded Files

```typescript
const analyzer = new GeminiVideoAnalyzer();

// Upload once
const file = await analyzer.uploadAndWait("./video.mp4", {
  mimeType: "video/mp4",
  displayName: "Training Video",
});

// Analyze multiple times with different prompts
const summary = await analyzer.analyze(file, "Provide a summary");
const quiz = await analyzer.analyze(file, "Create a 5-question quiz");
const timestamps = await analyzer.analyze(
  file,
  "List timestamps of key moments"
);

// Clean up when done
await analyzer.delete(file.name);
```

## Error Handling with Retries

```typescript
async function analyzeWithRetry(
  analyzer: GeminiVideoAnalyzer,
  filePath: string,
  prompt: string,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await analyzer.processVideo(filePath, prompt, {
        mimeType: "video/mp4",
      });
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const backoff = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${backoff}ms...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

## Express.js Integration Example

```typescript
import express from "express";
import multer from "multer";
import { GeminiVideoAnalyzer } from "./gemini-video-analyzer";

const app = express();
const upload = multer({ dest: "uploads/" });
const analyzer = new GeminiVideoAnalyzer();

app.post("/analyze", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file uploaded" });
  }

  try {
    const result = await analyzer.processVideo(
      req.file.path,
      req.body.prompt ?? "Describe this video",
      { mimeType: req.file.mimetype },
      { deleteAfterAnalysis: true }
    );

    res.json({ analysis: result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(3000);
```

## MIME Type Helper

```typescript
const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".3gp": "video/3gpp",
};

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    throw new Error(`Unsupported video format: ${ext}`);
  }

  return mimeType;
}

// Usage
const mimeType = getMimeType("./video.mp4"); // "video/mp4"
```
