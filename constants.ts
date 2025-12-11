export const GEMINI_MODEL = "gemini-3-pro-preview";
export const MAX_VIDEO_SIZE_MB = 500; // Max upload size for backend chunking

// Chunk size threshold - videos larger than this get sent to backend for chunking
// Configurable via VITE_CHUNK_SIZE_MB env var (default: 10MB)
// Smaller chunks = fewer tokens per API request = less likely to hit 429 rate limits
export const CHUNK_SIZE_THRESHOLD_MB = parseInt(import.meta.env.VITE_CHUNK_SIZE_MB || '10', 10);

// Vertex AI defaults
export const VERTEX_DEFAULT_MODEL = "gemini-3-pro-preview";
export const VERTEX_DEFAULT_LOCATION = "global";

// Available Vertex AI locations
export const VERTEX_LOCATIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west1",
  "us-west4",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "asia-east1",
  "asia-northeast1",
  "asia-southeast1",
  "global"
];
