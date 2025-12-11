import { ProcessingStatus, NoteSegment, ChunkInfo } from '../types';

const API_BASE = '/api/sessions';

export interface SessionListItem {
  id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  date: string;
  status: number;
  noteCount: number;
}

export interface NoteWithUrl {
  timestamp: number;
  title: string;
  markdown: string;
  imageUrl: string | null;
}

export interface SessionDetail {
  id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  date: string;
  status: number;
  error: string | null;
  youtubeSessionId: string | null;
  uploadSessionId: string | null;
  totalDuration: number | null;
  chunks: Array<{ id: string; startTime: number; endTime: number }>;
  notes: NoteWithUrl[];
}

export interface SessionCreateInput {
  id: string;
  title: string;
  url?: string;
  thumbnail?: string;
  date: string;
  status: number;
  error?: string;
  youtubeSessionId?: string;
  uploadSessionId?: string;
  totalDuration?: number;
  chunks?: ChunkInfo[];
  notes?: NoteSegment[];
}

export interface SessionsListResponse {
  sessions: SessionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Fetch all sessions with pagination.
 */
export async function getSessions(page = 1, pageSize = 20): Promise<SessionsListResponse> {
  const response = await fetch(`${API_BASE}?page=${page}&pageSize=${pageSize}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sessions');
  }

  return response.json();
}

/**
 * Fetch a single session with notes.
 */
export async function getSession(id: string): Promise<SessionDetail> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Session not found');
  }

  return response.json();
}

/**
 * Create a new session.
 */
export async function createSession(session: SessionCreateInput): Promise<SessionDetail> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create session');
  }

  return response.json();
}

/**
 * Update an existing session.
 */
export async function updateSession(id: string, updates: Partial<SessionCreateInput>): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update session');
  }
}

/**
 * Delete a session and all associated data.
 */
export async function deleteSession(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete session');
  }
}

/**
 * Save notes for a session (replaces existing notes).
 */
export async function saveNotes(sessionId: string, notes: NoteSegment[]): Promise<SessionDetail> {
  const response = await fetch(`${API_BASE}/${sessionId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save notes');
  }

  return response.json();
}

/**
 * Convert API session format to VideoSession format for frontend use.
 */
export function toVideoSession(detail: SessionDetail): {
  id: string;
  title: string;
  url?: string;
  thumbnail?: string;
  date: Date;
  status: ProcessingStatus;
  error?: string;
  youtubeSessionId?: string;
  uploadSessionId?: string;
  totalDuration?: number;
  chunks?: ChunkInfo[];
  notes?: NoteSegment[];
} {
  return {
    id: detail.id,
    title: detail.title,
    url: detail.url || undefined,
    thumbnail: detail.thumbnail || undefined,
    date: new Date(detail.date),
    status: detail.status as ProcessingStatus,
    error: detail.error || undefined,
    youtubeSessionId: detail.youtubeSessionId || undefined,
    uploadSessionId: detail.uploadSessionId || undefined,
    totalDuration: detail.totalDuration || undefined,
    chunks: detail.chunks.length > 0 ? detail.chunks : undefined,
    notes: detail.notes.map(note => ({
      timestamp: note.timestamp,
      title: note.title,
      markdown: note.markdown,
      imageUrl: note.imageUrl || undefined,
    })),
  };
}
