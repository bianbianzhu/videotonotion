# Plan: Add Size Validation + Exponential Backoff for Vertex AI Analysis

## Problem Summary

When processing large YouTube videos with Vertex AI inline strategy:

```
ApiError: {"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}
```

**Root Cause:** Large videos sent as inline base64 exceed API size limits (400 is deterministic, not transient)

**Solution:**

1. Add size validation before sending to Vertex AI
2. Route oversized videos to existing GCS strategy
3. Add retry logic ONLY for truly transient errors (429, 5xx, UNAVAILABLE)

---

## Implementation Plan

### 1. Create Retry Utility Function

**File:** `utils/retry.ts` (new file)

```typescript
export interface RetryOptions {
  maxRetries: number; // Default: 3
  baseDelayMs: number; // Default: 2000 (2 seconds)
  maxDelayMs: number; // Default: 32000 (32 seconds)
  retryableErrors?: (error: any) => boolean;
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (options.retryableErrors && !options.retryableErrors(error)) {
        throw error; // Non-retryable, fail immediately
      }

      if (attempt < options.maxRetries) {
        // Calculate delay with jitter: 2^attempt * baseDelay * (1 ± 10%)
        const jitter = 1 + (Math.random() - 0.5) * 0.2; // ±10%
        const delay = Math.min(
          options.baseDelayMs * Math.pow(2, attempt) * jitter,
          options.maxDelayMs
        );
        console.log(
          `Retry attempt ${attempt + 1}/${
            options.maxRetries
          } after ${Math.round(delay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### 2. Add Size Validation in aiService.ts

**File:** `services/aiService.ts`

Add validation at the start of `analyzeVideoVertexInline`:

```typescript
const MAX_INLINE_BASE64_BYTES = 20 * 1024 * 1024; // 20MB limit for inline

export async function analyzeVideoVertexInline(
  projectId: string,
  location: string,
  model: string,
  base64Data: string,
  mimeType: string,
  chunkContext?: ChunkContext,
  language: NoteLanguage = "en"
): Promise<NoteSegment[]> {
  // Validate base64 size before sending to Vertex AI
  const base64SizeBytes = Math.ceil((base64Data.length * 3) / 4);
  if (base64SizeBytes > MAX_INLINE_BASE64_BYTES) {
    throw new Error(
      `Video chunk too large for inline processing (${(
        base64SizeBytes /
        1024 /
        1024
      ).toFixed(1)}MB). ` +
        `Max: 20MB. Use GCS endpoint (/api/ai/vertex/gcs/upload) for large videos.`
    );
  }

  // ... rest of existing code ...
}
```

### 3. Add Retry Logic to generateContent Calls

**File:** `services/aiService.ts`

Import and use retry utility:

```typescript
import { withExponentialBackoff } from '../utils/retry';

// Only retry on truly transient errors (NOT 400)
const isRetryableError = (error: any): boolean => {
  const message = error?.message || '';
  const status = error?.status;

  if (status === 429) return true;  // Rate limited
  if (status >= 500) return true;   // Server errors
  if (message.includes('UNAVAILABLE')) return true;
  if (message.includes('RESOURCE_EXHAUSTED')) return true;

  return false; // 400 and other errors are NOT retryable
};

export async function analyzeVideoVertexInline(...) {
  // ... validation & setup code ...

  const response = await withExponentialBackoff(
    () => ai.models.generateContent({
      model: visionModel,
      contents,
      config,
    }),
    {
      maxRetries: 3,
      baseDelayMs: 2000,  // 2s, 4s, 8s
      maxDelayMs: 16000,
      retryableErrors: isRetryableError,
    }
  );

  // ... rest of function ...
}

// Apply same retry to analyzeVideoVertexGcs
export async function analyzeVideoVertexGcs(...) {
  // ... existing setup code ...

  const response = await withExponentialBackoff(
    () => ai.models.generateContent({...}),
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 16000,
      retryableErrors: isRetryableError,
    }
  );

  // ... rest of function ...
}
```

### 4. Update Error Handling in Routes

**File:** `routes/ai.ts`

Provide clearer error messages:

```typescript
} else if (error.status === 400 || errorMessage.includes('INVALID_ARGUMENT')) {
  errorMessage = 'Request invalid or too large for inline processing. ' +
    'Use /api/ai/vertex/gcs/upload endpoint for videos > 20MB.';
}
```

---

## Files to Modify

| File                    | Changes                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `utils/retry.ts`        | New file - exponential backoff with jitter                  |
| `services/aiService.ts` | Add size validation + retry logic, exclude 400 from retries |
| `routes/ai.ts`          | Update error message to guide users to GCS                  |

---

## Retry Behavior

| Attempt | Delay (with ±10% jitter) |
| ------- | ------------------------ |
| 1st     | ~2 seconds               |
| 2nd     | ~4 seconds               |
| 3rd     | ~8 seconds               |
| Fail    | Throw error              |

**Retryable errors ONLY:**

- 429 (Rate Limited)
- 5xx (Server Errors)
- UNAVAILABLE
- RESOURCE_EXHAUSTED

**NOT retryable (fail fast):**

- 400 INVALID_ARGUMENT (will be caught by size validation)
- Invalid MIME type
- Authentication errors

---

## Verification

1. **Test oversized video**

   - Send inline video > 20MB
   - Should get clear error: "Request invalid or too large... Use /api/ai/vertex/gcs/upload"

2. **Test normal video**

   - Small video < 20MB inline
   - Should work on first attempt

3. **Test rate limiting (429)**

   - Simulate 429 error
   - Should retry 3 times with exponential backoff
   - Should succeed or fail with clear message

4. **Check logs**
   - Should see "Retry attempt X/3 after Yms..." messages for transient errors
   - No retries for 400/invalid payload errors
