import { NoteSegment, ChunkContext, FilesApiUploadProgress, GcsUploadProgress } from '../types';
import { generateNotesFromVideoGemini, generateNotesFromVideoWithFilesApi } from './geminiService';
import { generateNotesFromVideoVertex, generateNotesFromVideoVertexGcs } from './vertexService';

export interface GeminiConfig {
  provider: 'gemini';
  apiKey: string;
  model?: string;
  strategy: 'inline' | 'filesApi';  // Files API only works with Gemini
}

export interface VertexConfig {
  provider: 'vertex';
  projectId: string;
  location: string;
  model?: string;
  strategy: 'inline' | 'gcs';       // GCS only works with Vertex AI (Files API NOT supported)
  gcsBucket?: string;               // Required when strategy is 'gcs'
}

export type AIConfig = GeminiConfig | VertexConfig;

export interface AIProvider {
  generateNotesFromVideo(base64Data: string, mimeType: string, chunkContext?: ChunkContext): Promise<NoteSegment[]>;
  // Gemini Files API (only works with Gemini, NOT Vertex AI)
  generateNotesFromVideoWithFilesApi(
    file: File | Blob,
    mimeType: string,
    onProgress?: (progress: FilesApiUploadProgress) => void
  ): Promise<NoteSegment[]>;
  // GCS upload (only works with Vertex AI)
  generateNotesFromVideoWithGcs(
    file: File | Blob,
    mimeType: string,
    bucketName: string,
    onProgress?: (progress: GcsUploadProgress) => void
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
    // Files API only works with Gemini (NOT Vertex AI)
    async generateNotesFromVideoWithFilesApi(
      file: File | Blob,
      mimeType: string,
      onProgress?: (progress: FilesApiUploadProgress) => void
    ): Promise<NoteSegment[]> {
      if (config.provider !== 'gemini') {
        throw new Error('Files API is only supported with Gemini API. Use GCS for Vertex AI.');
      }
      return generateNotesFromVideoWithFilesApi(config.apiKey, file, mimeType, config.model, onProgress);
    },
    // GCS only works with Vertex AI
    async generateNotesFromVideoWithGcs(
      file: File | Blob,
      mimeType: string,
      bucketName: string,
      onProgress?: (progress: GcsUploadProgress) => void
    ): Promise<NoteSegment[]> {
      if (config.provider !== 'vertex') {
        throw new Error('GCS upload is only supported with Vertex AI. Use Files API for Gemini.');
      }
      return generateNotesFromVideoVertexGcs(
        config.projectId,
        config.location,
        file,
        mimeType,
        bucketName,
        config.model,
        onProgress
      );
    },
  };
}

export function isConfigValid(config: AIConfig | null): boolean {
  if (!config) return false;

  if (config.provider === 'gemini') {
    return Boolean(config.apiKey && config.apiKey.length > 0);
  } else {
    // Vertex: projectId is optional (falls back to env vars), location has default
    // GCS bucket is optional - server uses GCS_BUCKET_NAME env var as fallback
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
