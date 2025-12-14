import "dotenv/config";
import {
  ContentListUnion,
  GenerateContentConfig,
  GoogleGenAI,
} from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/** A single note segment extracted from video analysis */

const segmentSchema = z.object({
  timestamp: z
    .number()
    .describe(
      "The exact timestamp (in seconds) where the visual slide or key content appears. The timestamp should be relative to the chunk, starting from 0."
    ),
  title: z.string().describe("A concise title for the section."),
  markdown: z
    .string()
    .describe(
      "Field 'markdown': A detailed markdown-formatted content paragraph of the spoken content for that section."
    ),
});

const responseSchema = z
  .array(segmentSchema)
  .describe("An array of note segments with timestamps and content.");

export type NoteSegment = z.infer<typeof segmentSchema>;

export interface ChunkContext {
  chunkNumber: number;
  totalChunks: number;
  chunkStartTime: number;
  chunkEndTime: number;
  totalDuration: number;
  previousTopics?: string[];
}

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
    1. The exact timestamp (in seconds) where the visual slide or key content appears. (These timestamps should be precise and accurate as they will be used to extract frames from the video.)
    2. A concise title for the section.
    3. A detailed content paragraph in the "markdown" field of the spoken content for that section. Use markdown formatting, just like you would in a document, with:
    - Headers
    - Blockquotes
    - Bullet point lists

    Return the response strictly as a JSON array.
    Ensure timestamps are chronological.

    Example response:
    [
      {
        "timestamp": 10.0,
        "title": "Introduction",
        "markdown": "This is the introduction to the lecture."
      },
      ...
    ]

    IMPORTANT: Do not include any other text or comments in your response. Only return the JSON array.`;
};

/**
 * Analyzes video content using Vertex AI to generate structured notes.
 * @param projectId - Google Cloud project ID (optional, uses ADC default)
 * @param location - Vertex AI location (e.g., 'global', 'us-central1')
 * @param model - Model name (e.g., 'gemini-2.0-flash')
 * @param base64Data - Base64-encoded video data
 * @param mimeType - Video MIME type
 * @param chunkContext - Optional context for chunked video processing
 * @returns Array of note segments with timestamps and content
 */
export async function analyzeVideoWithVertex(
  projectId: string,
  location: string,
  model: string,
  base64Data: string,
  mimeType: string,
  chunkContext?: ChunkContext
): Promise<NoteSegment[]> {
  const project = projectId || process.env.VERTEX_AI_PROJECT_ID;
  const region = location || process.env.VERTEX_AI_LOCATION;
  const visionModel =
    model || process.env.VERTEX_AI_MODEL || "gemini-3-pro-preview";

  // Initialize with Vertex AI backend
  const ai = new GoogleGenAI({
    vertexai: true,
    project: project || "my-project",
    location: region || "global",
  });

  const prompt = buildAnalysisPrompt(chunkContext);

  const contents: ContentListUnion = [
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    },
    { text: prompt },
  ];

  const config: GenerateContentConfig = {
    temperature: 0.2,
    responseMimeType: "application/json",
    // @ts-expect-error Argument type mismatch workaround: zodToJsonSchema expects ZodType
    responseJsonSchema: zodToJsonSchema(responseSchema),
  };

  const response = await ai.models.generateContent({
    model: visionModel,
    contents,
    config,
  });

  const text = response.text;

  if (!text) {
    throw new Error("No response text from Vertex AI");
  }

  return responseSchema.parse(JSON.parse(text));
}
