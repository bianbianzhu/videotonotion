import { NoteSegment } from '../types';
import { VERTEX_DEFAULT_MODEL, VERTEX_DEFAULT_LOCATION } from '../constants';

const API_BASE = '/api/ai';

export const generateNotesFromVideoVertex = async (
  projectId: string,
  location: string,
  base64Data: string,
  mimeType: string,
  model?: string
): Promise<NoteSegment[]> => {
  const response = await fetch(`${API_BASE}/vertex/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      location: location || VERTEX_DEFAULT_LOCATION,
      model: model || VERTEX_DEFAULT_MODEL,
      base64Data,
      mimeType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Vertex AI analysis failed');
  }

  const result = await response.json();
  return result.segments as NoteSegment[];
};
