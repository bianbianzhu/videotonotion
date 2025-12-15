# Official Documentation Sources

References for the patterns and best practices in this skill.

## Polling Strategy

The file state polling pattern is documented in multiple official Google sources:

### Using Files API (Primary Reference)

**URL**: https://ai.google.dev/api/files

Official JavaScript polling example:

```javascript
// Poll until the video file is completely processed (state becomes ACTIVE).
while (!myfile.state || myfile.state.toString() !== "ACTIVE") {
  console.log("Processing video...");
  console.log("File state: ", myfile.state);
  await sleep(5000);
  myfile = await ai.files.get({ name: myfile.name });
}
```

Official Python polling example:

```python
while not myfile.state or myfile.state.name != "ACTIVE":
    print("Processing video...")
    print("File state:", myfile.state)
    time.sleep(5)
    myfile = client.files.get(name=myfile.name)
```

### Context Caching Documentation

**URL**: https://ai.google.dev/gemini-api/docs/caching

```python
# Wait for the file to finish processing
while video_file.state.name == 'PROCESSING':
    print('Waiting for video to be processed.')
    time.sleep(2)
    video_file = client.files.get(name=video_file.name)
```

### Video Understanding Documentation

**URL**: https://ai.google.dev/gemini-api/docs/video-understanding

Contains the complete video upload workflow examples for all supported languages.

### Files API Documentation

**URL**: https://ai.google.dev/gemini-api/docs/files

Documents file upload, metadata retrieval, listing, and deletion operations.

## Key Documentation Notes

From Google's generative-ai-docs repository (vision.ipynb):

> "**NOTE**: Video files have a `State` field in the File API. When a video is uploaded, it will be in the `PROCESSING` state until it is ready for inference. Only `ACTIVE` files can be used for model inference."

From GitHub issue #534 in google/generative-ai-docs:

> "Some files uploaded to the Gemini API need to be processed before they can be used as prompt inputs. The status can be seen by querying the file's 'state' field. This implementation uses a simple blocking polling loop."

## SDK References

### Official SDK

- **Package**: `@google/genai`
- **npm**: https://www.npmjs.com/package/@google/genai
- **GitHub**: https://github.com/googleapis/js-genai
- **Docs**: https://googleapis.github.io/js-genai/

### Legacy SDK (Deprecated)

- **Package**: `@google/generative-ai`
- **Status**: End-of-life August 31, 2025
- **Note**: Migrate to `@google/genai` for new features and continued support

## Files API Limits

From https://ai.google.dev/gemini-api/docs/files:

- Per-project storage: 20 GB
- Per-file maximum size: 2 GB
- File retention: 48 hours (auto-deleted)
- Cost: Free in all Gemini API regions

## File States

| State        | Description                                     |
| ------------ | ----------------------------------------------- |
| `PROCESSING` | File is being processed server-side             |
| `ACTIVE`     | File is ready for use in prompts                |
| `FAILED`     | Processing failed (corrupt or unsupported file) |
