import { NoteSegment, ChunkContext } from '../types';
import { generateNotesFromVideoGemini } from './geminiService';
import { generateNotesFromVideoVertex } from './vertexService';

export interface GeminiConfig {
  provider: 'gemini';
  apiKey: string;
  model?: string;
}

export interface VertexConfig {
  provider: 'vertex';
  projectId: string;
  location: string;
  model?: string;
}

export type AIConfig = GeminiConfig | VertexConfig;

export interface AIProvider {
  generateNotesFromVideo(base64Data: string, mimeType: string, chunkContext?: ChunkContext): Promise<NoteSegment[]>;
}

export function createAIProvider(config: AIConfig): AIProvider {
  return {
    async generateNotesFromVideo(base64Data: string, mimeType: string, chunkContext?: ChunkContext): Promise<NoteSegment[]> {
      if (config.provider === 'gemini') {
        return generateNotesFromVideoGemini(config.apiKey, base64Data, mimeType, config.model, chunkContext);
      } else {
        return generateNotesFromVideoVertex(
          config.projectId,
          config.location,
          base64Data,
          mimeType,
          config.model,
          chunkContext
        );
      }
    },
  };
}

export function isConfigValid(config: AIConfig | null): boolean {
  if (!config) return false;

  if (config.provider === 'gemini') {
    return Boolean(config.apiKey && config.apiKey.length > 0);
  } else {
    // Vertex: projectId is optional (falls back to env vars), location has default
    return true;
  }
}

export function getDefaultConfig(): AIConfig {
  return {
    provider: 'gemini',
    apiKey: '',
  };
}
