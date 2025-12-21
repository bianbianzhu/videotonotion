export interface NoteSegment {
  timestamp: number;
  title: string;
  markdown: string;
  image?: string; // Data URL of the extracted frame (used during processing)
  imageUrl?: string; // Server URL for persisted images (from database)
}

// Output language for generated notes
// - 'en': English
// - 'zh': Simplified Chinese (简体中文)
export type NoteLanguage = 'en' | 'zh';

// Video analysis strategy selection
// - 'inline': Chunk and base64 encode (works with both Gemini and Vertex AI)
// - 'filesApi': Upload to Gemini Files API (Gemini API only, NOT Vertex AI)
// - 'gcs': Upload to Google Cloud Storage (Vertex AI only)
export type VideoAnalysisStrategy = 'inline' | 'filesApi' | 'gcs';

export interface VideoMetadata {
  name: string;
  duration: number;
  url?: string;
}

export enum ProcessingStatus {
  IDLE,
  DOWNLOADING, // New status for fetching the video
  READY,       // Video is local (blob) and ready to process
  UPLOADING,   // Uploading to Gemini (conceptually part of analyzing)
  ANALYZING,
  EXTRACTING_FRAMES,
  COMPLETED,
  ERROR,
  // Files API specific statuses (Gemini API only)
  UPLOADING_TO_FILES_API, // Uploading video to Gemini Files API
  PROCESSING_FILE,        // Waiting for file to become ACTIVE on Gemini servers
  // GCS specific statuses (Vertex AI only)
  UPLOADING_TO_GCS,       // Uploading video to Google Cloud Storage
}

// Files API upload progress tracking (Gemini API only)
export interface FilesApiUploadProgress {
  phase: 'uploading' | 'processing' | 'ready';
  uploadProgress?: number;      // 0-100 during upload phase
  processingStartTime?: number; // Timestamp when processing started (for elapsed time)
  fileName?: string;            // Gemini file name for status checks
  fileUri?: string;             // Gemini file URI for analysis
}

// GCS upload progress tracking (Vertex AI only)
export interface GcsUploadProgress {
  phase: 'uploading' | 'ready';
  uploadProgress?: number;      // 0-100 during upload phase
  gcsUri?: string;              // gs://bucket/path URI for analysis
  bucketName?: string;          // GCS bucket name
  objectName?: string;          // GCS object name (file path in bucket)
}

export interface ChunkInfo {
  id: string;
  startTime: number;
  endTime: number;
}

export interface ChunkContext {
  chunkNumber: number;      // 1-indexed
  totalChunks: number;
  chunkStartTime: number;   // seconds
  chunkEndTime: number;     // seconds
  totalDuration: number;    // seconds
  previousTopics?: string[]; // titles from previous chunk for continuity
}

export interface VideoSession {
  id: string;
  title: string;
  url?: string;
  file?: File | Blob; // The local video file
  thumbnail?: string;
  date: Date;
  status: ProcessingStatus;
  notes?: NoteSegment[];
  error?: string;
  progress?: number; // 0-100 for download/processing
  // YouTube-specific fields
  youtubeSessionId?: string; // Backend session ID for fetching chunks
  // Upload-specific fields (for large local files)
  uploadSessionId?: string; // Backend session ID for uploaded chunked videos
  chunks?: ChunkInfo[]; // Video chunks for large videos
  currentChunk?: number; // Current chunk being processed
  totalDuration?: number; // Total video duration in seconds
  // Files API specific fields (Gemini API only)
  filesApiUpload?: FilesApiUploadProgress; // Progress tracking for Files API upload
  // GCS specific fields (Vertex AI only)
  gcsUpload?: GcsUploadProgress;           // Progress tracking for GCS upload
  analysisStrategy?: VideoAnalysisStrategy; // Track which strategy was used
}
