import { VertexAI } from '@google-cloud/vertexai';

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
 * @param projectId - Google Cloud project ID
 * @param location - Vertex AI location (e.g., 'us-central1')
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
  const vertexAI = new VertexAI({
    project: projectId,
    location: location,
  });

  const generativeModel = vertexAI.getGenerativeModel({
    model: model,
  });

  const response = await generativeModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: VIDEO_ANALYSIS_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const result = response.response;
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response text from Vertex AI');
  }

  return JSON.parse(text) as NoteSegment[];
}
