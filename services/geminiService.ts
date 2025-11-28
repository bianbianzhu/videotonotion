import { GoogleGenAI, Type } from "@google/genai";
import { NoteSegment } from "../types";
import { GEMINI_MODEL } from "../constants";

export const VIDEO_ANALYSIS_PROMPT = `
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
  mimeType: string
): Promise<NoteSegment[]> => {
  return generateNotesFromVideoGemini(apiKey, base64Data, mimeType);
};

export const generateNotesFromVideoGemini = async (
  apiKey: string,
  base64Data: string,
  mimeType: string,
  model?: string
): Promise<NoteSegment[]> => {
  const ai = new GoogleGenAI({ apiKey });

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
            text: VIDEO_ANALYSIS_PROMPT,
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
