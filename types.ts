export interface NoteSegment {
  timestamp: number;
  title: string;
  markdown: string;
  image?: string; // Data URL of the extracted frame
}

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
  ERROR
}

export interface ChunkInfo {
  id: string;
  startTime: number;
  endTime: number;
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
  chunks?: ChunkInfo[]; // Video chunks for large videos
  currentChunk?: number; // Current chunk being processed
}