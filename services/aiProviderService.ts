import { NoteSegment, ChunkContext, VideoAnalysisStrategy, FilesApiUploadProgress } from '../types';
import { generateNotesFromVideoGemini, generateNotesFromVideoWithFilesApi } from './geminiService';
import { generateNotesFromVideoVertex, generateNotesFromVideoVertexFilesApi } from './vertexService';

export interface GeminiConfig {
  provider: 'gemini';
  apiKey: string;
  model?: string;
  strategy: VideoAnalysisStrategy;
}

export interface VertexConfig {
  provider: 'vertex';
  projectId: string;
  location: string;
  model?: string;
  strategy: VideoAnalysisStrategy;
}

export type AIConfig = GeminiConfig | VertexConfig;

export interface AIProvider {
  generateNotesFromVideo(base64Data: string, mimeType: string, chunkContext?: ChunkContext): Promise<NoteSegment[]>;
  generateNotesFromVideoWithFilesApi(
    file: File | Blob,
    mimeType: string,
    onProgress?: (progress: FilesApiUploadProgress) => void
  ): Promise<NoteSegment[]>;
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
    async generateNotesFromVideoWithFilesApi(
      file: File | Blob,
      mimeType: string,
      onProgress?: (progress: FilesApiUploadProgress) => void
    ): Promise<NoteSegment[]> {
      if (config.provider === 'gemini') {
        return generateNotesFromVideoWithFilesApi(config.apiKey, file, mimeType, config.model, onProgress);
      } else {
        return generateNotesFromVideoVertexFilesApi(
          config.projectId,
          config.location,
          file,
          mimeType,
          config.model,
          onProgress
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
    strategy: 'inline', // Default to inline for backward compatibility
  };
}
