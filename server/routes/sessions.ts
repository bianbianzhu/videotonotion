import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import {
  getAllSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  saveNotes,
  SessionInput,
  NoteInput,
} from '../db/sessionRepository';
import { getImageAbsolutePath, imageExists } from '../services/imageStorageService';
import fs from 'fs';

const router: RouterType = Router();

/**
 * GET /api/sessions
 * List all sessions with pagination
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

    const result = getAllSessions(page, pageSize);
    res.json({
      sessions: result.sessions,
      total: result.total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/sessions/:id
 * Get a single session with notes
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const session = getSessionById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Transform notes to include image URLs
    const notesWithUrls = session.notes.map((note, index) => ({
      timestamp: note.timestamp,
      title: note.title,
      markdown: note.markdown,
      imageUrl: note.imagePath ? `/api/sessions/${session.id}/notes/${index}/image` : null,
    }));

    res.json({
      ...session,
      notes: notesWithUrls,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * POST /api/sessions
 * Create a new session
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as SessionInput;

    // Validate required fields
    if (!body.id || !body.title || !body.date) {
      return res.status(400).json({ error: 'Missing required fields: id, title, date' });
    }

    const session = createSession(body);

    // Transform response to include image URLs
    const notesWithUrls = session.notes.map((note, index) => ({
      timestamp: note.timestamp,
      title: note.title,
      markdown: note.markdown,
      imageUrl: note.imagePath ? `/api/sessions/${session.id}/notes/${index}/image` : null,
    }));

    res.status(201).json({
      ...session,
      notes: notesWithUrls,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * PUT /api/sessions/:id
 * Update a session
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = getSessionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    updateSession(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete a session and all associated data
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteSession(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * POST /api/sessions/:id/notes
 * Save or replace notes for a session
 */
router.post('/:id/notes', (req: Request, res: Response) => {
  try {
    const existing = getSessionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const notes = req.body.notes as NoteInput[];
    if (!Array.isArray(notes)) {
      return res.status(400).json({ error: 'Notes must be an array' });
    }

    saveNotes(req.params.id, notes);

    // Return updated session
    const session = getSessionById(req.params.id)!;
    const notesWithUrls = session.notes.map((note, index) => ({
      timestamp: note.timestamp,
      title: note.title,
      markdown: note.markdown,
      imageUrl: note.imagePath ? `/api/sessions/${session.id}/notes/${index}/image` : null,
    }));

    res.json({
      ...session,
      notes: notesWithUrls,
    });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

/**
 * GET /api/sessions/:id/notes/:noteIndex/image
 * Get the image for a specific note
 */
router.get('/:id/notes/:noteIndex/image', (req: Request, res: Response) => {
  try {
    const session = getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const noteIndex = parseInt(req.params.noteIndex);
    if (isNaN(noteIndex) || noteIndex < 0 || noteIndex >= session.notes.length) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = session.notes[noteIndex];
    if (!note.imagePath) {
      return res.status(404).json({ error: 'Note has no image' });
    }

    if (!imageExists(note.imagePath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    const imagePath = getImageAbsolutePath(note.imagePath);
    res.type('image/jpeg');
    fs.createReadStream(imagePath).pipe(res);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

export default router;
