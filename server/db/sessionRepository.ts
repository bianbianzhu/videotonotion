import db from './index';
import { saveImage, deleteSessionImages } from '../services/imageStorageService';

export interface SessionRow {
  id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  date: string;
  status: number;
  error: string | null;
  youtube_session_id: string | null;
  upload_session_id: string | null;
  total_duration: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChunkRow {
  id: string;
  session_id: string;
  start_time: number;
  end_time: number;
}

export interface NoteRow {
  id: number;
  session_id: string;
  position: number;
  timestamp: number;
  title: string;
  markdown: string;
  image_path: string | null;
}

export interface NoteInput {
  timestamp: number;
  title: string;
  markdown: string;
  image?: string; // Base64 data URL
}

export interface SessionInput {
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
  chunks?: Array<{ id: string; startTime: number; endTime: number }>;
  notes?: NoteInput[];
}

export interface SessionListItem {
  id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  date: string;
  status: number;
  noteCount: number;
}

export interface SessionDetail extends Omit<SessionRow, 'youtube_session_id' | 'upload_session_id' | 'total_duration'> {
  youtubeSessionId: string | null;
  uploadSessionId: string | null;
  totalDuration: number | null;
  chunks: Array<{ id: string; startTime: number; endTime: number }>;
  notes: Array<{
    timestamp: number;
    title: string;
    markdown: string;
    imagePath: string | null;
  }>;
}

// Prepared statements
const stmts = {
  getAllSessions: db.prepare(`
    SELECT s.*, COUNT(n.id) as note_count
    FROM sessions s
    LEFT JOIN notes n ON s.id = n.session_id
    GROUP BY s.id
    ORDER BY s.date DESC
    LIMIT ? OFFSET ?
  `),

  getSessionCount: db.prepare(`SELECT COUNT(*) as count FROM sessions`),

  getSessionById: db.prepare(`SELECT * FROM sessions WHERE id = ?`),

  getChunksBySessionId: db.prepare(`
    SELECT * FROM chunks WHERE session_id = ? ORDER BY start_time
  `),

  getNotesBySessionId: db.prepare(`
    SELECT * FROM notes WHERE session_id = ? ORDER BY position
  `),

  insertSession: db.prepare(`
    INSERT INTO sessions (id, title, url, thumbnail, date, status, error, youtube_session_id, upload_session_id, total_duration)
    VALUES (@id, @title, @url, @thumbnail, @date, @status, @error, @youtubeSessionId, @uploadSessionId, @totalDuration)
  `),

  updateSession: db.prepare(`
    UPDATE sessions SET
      title = COALESCE(@title, title),
      url = COALESCE(@url, url),
      thumbnail = COALESCE(@thumbnail, thumbnail),
      status = COALESCE(@status, status),
      error = @error,
      youtube_session_id = COALESCE(@youtubeSessionId, youtube_session_id),
      upload_session_id = COALESCE(@uploadSessionId, upload_session_id),
      total_duration = COALESCE(@totalDuration, total_duration),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),

  deleteSession: db.prepare(`DELETE FROM sessions WHERE id = ?`),

  insertChunk: db.prepare(`
    INSERT INTO chunks (id, session_id, start_time, end_time)
    VALUES (@id, @sessionId, @startTime, @endTime)
  `),

  deleteChunksBySessionId: db.prepare(`DELETE FROM chunks WHERE session_id = ?`),

  insertNote: db.prepare(`
    INSERT INTO notes (session_id, position, timestamp, title, markdown, image_path)
    VALUES (@sessionId, @position, @timestamp, @title, @markdown, @imagePath)
  `),

  deleteNotesBySessionId: db.prepare(`DELETE FROM notes WHERE session_id = ?`),
};

export function getAllSessions(page = 1, pageSize = 20): { sessions: SessionListItem[]; total: number } {
  const offset = (page - 1) * pageSize;
  const rows = stmts.getAllSessions.all(pageSize, offset) as (SessionRow & { note_count: number })[];
  const { count: total } = stmts.getSessionCount.get() as { count: number };

  const sessions: SessionListItem[] = rows.map(row => ({
    id: row.id,
    title: row.title,
    url: row.url,
    thumbnail: row.thumbnail,
    date: row.date,
    status: row.status,
    noteCount: row.note_count,
  }));

  return { sessions, total };
}

export function getSessionById(id: string): SessionDetail | null {
  const row = stmts.getSessionById.get(id) as SessionRow | undefined;
  if (!row) return null;

  const chunks = (stmts.getChunksBySessionId.all(id) as ChunkRow[]).map(c => ({
    id: c.id,
    startTime: c.start_time,
    endTime: c.end_time,
  }));

  const notes = (stmts.getNotesBySessionId.all(id) as NoteRow[]).map(n => ({
    timestamp: n.timestamp,
    title: n.title,
    markdown: n.markdown,
    imagePath: n.image_path,
  }));

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    thumbnail: row.thumbnail,
    date: row.date,
    status: row.status,
    error: row.error,
    youtubeSessionId: row.youtube_session_id,
    uploadSessionId: row.upload_session_id,
    totalDuration: row.total_duration,
    created_at: row.created_at,
    updated_at: row.updated_at,
    chunks,
    notes,
  };
}

export function createSession(session: SessionInput): SessionDetail {
  const insertSessionTx = db.transaction(() => {
    stmts.insertSession.run({
      id: session.id,
      title: session.title,
      url: session.url || null,
      thumbnail: session.thumbnail || null,
      date: session.date,
      status: session.status,
      error: session.error || null,
      youtubeSessionId: session.youtubeSessionId || null,
      uploadSessionId: session.uploadSessionId || null,
      totalDuration: session.totalDuration || null,
    });

    // Insert chunks if provided
    if (session.chunks) {
      for (const chunk of session.chunks) {
        stmts.insertChunk.run({
          id: chunk.id,
          sessionId: session.id,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        });
      }
    }

    // Insert notes if provided (with image saving)
    if (session.notes) {
      for (let i = 0; i < session.notes.length; i++) {
        const note = session.notes[i];
        let imagePath: string | null = null;

        if (note.image) {
          imagePath = saveImage(session.id, i, note.image);
        }

        stmts.insertNote.run({
          sessionId: session.id,
          position: i,
          timestamp: note.timestamp,
          title: note.title,
          markdown: note.markdown,
          imagePath,
        });
      }
    }
  });

  insertSessionTx();
  return getSessionById(session.id)!;
}

export function updateSession(id: string, updates: Partial<SessionInput>): void {
  stmts.updateSession.run({
    id,
    title: updates.title || null,
    url: updates.url || null,
    thumbnail: updates.thumbnail || null,
    status: updates.status ?? null,
    error: updates.error === undefined ? null : updates.error,
    youtubeSessionId: updates.youtubeSessionId || null,
    uploadSessionId: updates.uploadSessionId || null,
    totalDuration: updates.totalDuration || null,
  });

  // Update chunks if provided
  if (updates.chunks) {
    stmts.deleteChunksBySessionId.run(id);
    for (const chunk of updates.chunks) {
      stmts.insertChunk.run({
        id: chunk.id,
        sessionId: id,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
      });
    }
  }
}

export function deleteSession(id: string): boolean {
  // Delete images from filesystem
  deleteSessionImages(id);

  // Delete from database (cascading will handle notes and chunks)
  const result = stmts.deleteSession.run(id);
  return result.changes > 0;
}

export function saveNotes(sessionId: string, notes: NoteInput[]): void {
  const saveNotesTx = db.transaction(() => {
    // Delete existing notes and images
    const existingNotes = stmts.getNotesBySessionId.all(sessionId) as NoteRow[];
    if (existingNotes.length > 0) {
      deleteSessionImages(sessionId);
    }
    stmts.deleteNotesBySessionId.run(sessionId);

    // Insert new notes
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      let imagePath: string | null = null;

      if (note.image) {
        imagePath = saveImage(sessionId, i, note.image);
      }

      stmts.insertNote.run({
        sessionId,
        position: i,
        timestamp: note.timestamp,
        title: note.title,
        markdown: note.markdown,
        imagePath,
      });
    }
  });

  saveNotesTx();
}
