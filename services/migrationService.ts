import { createSession, getSessions } from './sessionApiService';
import { ProcessingStatus } from '../types';

const STORAGE_KEY = 'videotonotion_sessions';
const MIGRATION_FLAG = 'videotonotion_migrated';

interface LocalStorageSession {
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
  notes?: Array<{
    timestamp: number;
    title: string;
    markdown: string;
    // Note: images are stripped in localStorage, so they won't be migrated
  }>;
}

/**
 * Check if localStorage has sessions that need migration.
 */
export function hasLocalStorageData(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if already migrated
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return false;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;

  try {
    const sessions = JSON.parse(saved);
    return Array.isArray(sessions) && sessions.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrate sessions from localStorage to the database.
 * Returns the number of sessions migrated.
 */
export async function migrateFromLocalStorage(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  // Check if already migrated
  if (localStorage.getItem(MIGRATION_FLAG)) {
    console.log('Migration already completed');
    return 0;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    console.log('No localStorage data to migrate');
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return 0;
  }

  let sessions: LocalStorageSession[];
  try {
    sessions = JSON.parse(saved);
    if (!Array.isArray(sessions)) {
      console.log('Invalid localStorage data format');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return 0;
    }
  } catch (e) {
    console.error('Failed to parse localStorage data:', e);
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return 0;
  }

  // Check if database already has sessions (avoid duplicates)
  try {
    const existing = await getSessions(1, 1);
    if (existing.total > 0) {
      console.log('Database already has sessions, skipping migration');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      localStorage.removeItem(STORAGE_KEY);
      return 0;
    }
  } catch (e) {
    console.warn('Could not check existing sessions:', e);
    // Continue with migration anyway
  }

  let migratedCount = 0;

  for (const session of sessions) {
    // Only migrate completed or ready sessions
    if (session.status < ProcessingStatus.READY || session.status === ProcessingStatus.ERROR) {
      continue;
    }

    try {
      await createSession({
        id: session.id,
        title: session.title,
        url: session.url,
        thumbnail: session.thumbnail,
        date: session.date,
        status: session.status,
        error: session.error,
        youtubeSessionId: session.youtubeSessionId,
        uploadSessionId: session.uploadSessionId,
        totalDuration: session.totalDuration,
        chunks: session.chunks,
        notes: session.notes?.map(note => ({
          timestamp: note.timestamp,
          title: note.title,
          markdown: note.markdown,
          // Note: images are not available in localStorage (they were stripped)
        })),
      });
      migratedCount++;
      console.log(`Migrated session: ${session.title}`);
    } catch (e) {
      console.error(`Failed to migrate session ${session.id}:`, e);
    }
  }

  // Mark migration as complete
  localStorage.setItem(MIGRATION_FLAG, 'true');

  // Clear old localStorage data
  localStorage.removeItem(STORAGE_KEY);

  console.log(`Migration complete: ${migratedCount} sessions migrated`);
  return migratedCount;
}

/**
 * Clear the migration flag to allow re-migration (for testing).
 */
export function resetMigration(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MIGRATION_FLAG);
}
