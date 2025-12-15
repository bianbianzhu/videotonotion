import { GoogleGenAI, Type, createUserContent, createPartFromUri } from "@google/genai";
import { NoteSegment, ChunkContext, FilesApiUploadProgress } from "../types";
import { GEMINI_MODEL, FILES_API_POLL_INTERVAL_MS, FILES_API_TIMEOUT_MS } from "../constants";

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const buildAnalysisPrompt = (chunkContext?: ChunkContext): string => {
  let contextPrefix = '';

  if (chunkContext) {
    const { chunkNumber, totalChunks, chunkStartTime, chunkEndTime, totalDuration, previousTopics } = chunkContext;
    const chunkDuration = chunkEndTime - chunkStartTime;
    contextPrefix = `
CONTEXT: This is video segment ${chunkNumber} of ${totalChunks}.
This chunk covers ${formatTime(chunkStartTime)} to ${formatTime(chunkEndTime)} in the full ${formatTime(totalDuration)} video.

IMPORTANT: All timestamps you return must be RELATIVE TO THIS CHUNK, starting from 0.
- Valid timestamp range: 0 to ${chunkDuration.toFixed(1)} seconds
- Do NOT use absolute timestamps from the full video
- Example: If something appears 30 seconds into this chunk, return timestamp: 30 (not ${chunkStartTime + 30})

${previousTopics && previousTopics.length > 0
  ? `Topics from previous segment (for continuity): ${previousTopics.join(', ')}`
  : 'This is the first segment of the video.'}

`;
  }

  return `${contextPrefix}Analyze this video for a technical lecture summary.
    I need to create structured notes for Notion.
    Identify the key topics and transitions.
    For each distinct section or key slide, provide:
    1. The exact timestamp (in seconds) where the visual slide or key content appears.
    2. A concise title for the section.
    3. A detailed summary paragraph of the spoken content for that section.

    Return the response strictly as a JSON array.
    Ensure timestamps are chronological.`;
};

export const VIDEO_ANALYSIS_PROMPT = buildAnalysisPrompt();

export const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      timestamp: { type: Type.NUMBER, description: "Timestamp in seconds" },
      title: { type: Type.STRING, description: "Section title" },
      markdown: { type: Type.STRING, description: "Detailed summary content" },
    },
    required: ["timestamp", "title", "markdown"],
  },
};

// Legacy function for backward compatibility
export const generateNotesFromVideo = async (
  apiKey: string,
  base64Data: string,
  mimeType: string,
  chunkContext?: ChunkContext
): Promise<NoteSegment[]> => {
  return generateNotesFromVideoGemini(apiKey, base64Data, mimeType, undefined, chunkContext);
};

export const generateNotesFromVideoGemini = async (
  apiKey: string,
  base64Data: string,
  mimeType: string,
  model?: string,
  chunkContext?: ChunkContext
): Promise<NoteSegment[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildAnalysisPrompt(chunkContext);

  try {
    const response = await ai.models.generateContent({
      model: model || GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    return JSON.parse(text) as NoteSegment[];
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Generate notes from video using Gemini Files API.
 * Uploads entire video (up to 2GB) without chunking.
 */
export const generateNotesFromVideoWithFilesApi = async (
  apiKey: string,
  file: File | Blob,
  mimeType: string,
  model?: string,
  onProgress?: (progress: FilesApiUploadProgress) => void
): Promise<NoteSegment[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelName = model || GEMINI_MODEL;

  // Phase 1: Upload file to Gemini Files API
  onProgress?.({ phase: 'uploading', uploadProgress: 0 });

  let uploadedFile = await ai.files.upload({
    file: file,
    config: {
      mimeType: mimeType,
      displayName: file instanceof File ? file.name : 'video.mp4',
    },
  });

  onProgress?.({
    phase: 'processing',
    fileName: uploadedFile.name,
    processingStartTime: Date.now(),
  });

  // Phase 2: Poll for ACTIVE state
  const startTime = Date.now();

  while (uploadedFile.state?.toString() !== 'ACTIVE') {
    if (Date.now() - startTime > FILES_API_TIMEOUT_MS) {
      throw new Error(`File processing timeout after ${FILES_API_TIMEOUT_MS / 1000}s. Try using Inline strategy.`);
    }

    if (uploadedFile.state?.toString() === 'FAILED') {
      throw new Error('File processing failed on Gemini servers. Try using Inline strategy.');
    }

    await new Promise(r => setTimeout(r, FILES_API_POLL_INTERVAL_MS));
    uploadedFile = await ai.files.get({ name: uploadedFile.name! });
  }

  onProgress?.({
    phase: 'ready',
    fileName: uploadedFile.name,
    fileUri: uploadedFile.uri,
  });

  // Phase 3: Analyze with file reference
  const prompt = buildAnalysisPrompt(); // No chunk context for full video

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri!, uploadedFile.mimeType!),
        prompt,
      ]),
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    // Cleanup: Delete the uploaded file (optional - auto-deletes after 48h)
    try {
      await ai.files.delete({ name: uploadedFile.name! });
    } catch (e) {
      console.warn('Failed to cleanup uploaded file:', e);
    }

    return JSON.parse(text) as NoteSegment[];
  } catch (error) {
    // Attempt cleanup on error
    try {
      await ai.files.delete({ name: uploadedFile.name! });
    } catch {
      // Ignore cleanup errors
    }
    console.error("Gemini Files API Error:", error);
    throw error;
  }
};
