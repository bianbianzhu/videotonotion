import 'dotenv/config';
import { ContentListUnion, GenerateContentConfig, GoogleGenAI } from '@google/genai';

/** A single note segment extracted from video analysis */
export interface NoteSegment {
  timestamp: number;
  title: string;
  markdown: string;
}

const VIDEO_ANALYSIS_PROMPT = `
    Analyze this video for a technical lecture summary.
    I need to create structured notes for Notion.
    Identify the key topics and transitions.
    For each distinct section or key slide, provide:
    1. The exact timestamp (in seconds) where the visual slide or key content appears.
    2. A concise title for the section.
    3. A detailed summary paragraph of the spoken content for that section.

    Return the response strictly as a JSON array.
    Ensure timestamps are chronological.
  `;

/**
 * Analyzes video content using Vertex AI to generate structured notes.
 * @param projectId - Google Cloud project ID (optional, uses ADC default)
 * @param location - Vertex AI location (e.g., 'global', 'us-central1')
 * @param model - Model name (e.g., 'gemini-2.0-flash')
 * @param base64Data - Base64-encoded video data
 * @param mimeType - Video MIME type
 * @returns Array of note segments with timestamps and content
 */
export async function analyzeVideoWithVertex(
  projectId: string,
  location: string,
  model: string,
  base64Data: string,
  mimeType: string
): Promise<NoteSegment[]> {
  const project = projectId || process.env.VERTEX_AI_PROJECT_ID;
  const region = location || process.env.VERTEX_AI_LOCATION;
  const visionModel = model || process.env.VERTEX_AI_MODEL || 'gemini-3-pro-preview';

  // Initialize with Vertex AI backend
  const ai = new GoogleGenAI({
    vertexai: true,
    project: project || 'my-project',
    location: region || 'global',
  });

  const contents: ContentListUnion = [
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    },
    { text: VIDEO_ANALYSIS_PROMPT },
  ];

  const config: GenerateContentConfig = {
    temperature: 0.2,
  };

  const response = await ai.models.generateContent({
    model: visionModel,
    contents,
    config,
  });

  const text = response.text;

  if (!text) {
    throw new Error('No response text from Vertex AI');
  }

  return JSON.parse(text) as NoteSegment[];
}
