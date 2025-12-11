import type Database from 'better-sqlite3';

const SCHEMA_VERSION = 1;

export function initializeSchema(db: Database.Database): void {
  // Check current schema version
  const versionRow = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
  `).get();

  if (!versionRow) {
    // Fresh database - create all tables
    createTables(db);
    db.prepare(`
      CREATE TABLE schema_version (version INTEGER NOT NULL)
    `).run();
    db.prepare(`INSERT INTO schema_version (version) VALUES (?)`).run(SCHEMA_VERSION);
    console.log(`Database initialized with schema version ${SCHEMA_VERSION}`);
  } else {
    // Check if migration needed
    const currentVersion = db.prepare(`SELECT version FROM schema_version`).get() as { version: number };
    if (currentVersion.version < SCHEMA_VERSION) {
      // Run migrations here if needed in the future
      db.prepare(`UPDATE schema_version SET version = ?`).run(SCHEMA_VERSION);
      console.log(`Database migrated to schema version ${SCHEMA_VERSION}`);
    }
  }
}

function createTables(db: Database.Database): void {
  // Sessions table
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT,
      thumbnail TEXT,
      date TEXT NOT NULL,
      status INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      youtube_session_id TEXT,
      upload_session_id TEXT,
      total_duration REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chunks table for large videos
  db.exec(`
    CREATE TABLE chunks (
      id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      PRIMARY KEY (session_id, id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Notes table
  db.exec(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      timestamp REAL NOT NULL,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      image_path TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Indexes for performance
  db.exec(`CREATE INDEX idx_sessions_date ON sessions(date DESC)`);
  db.exec(`CREATE INDEX idx_sessions_status ON sessions(status)`);
  db.exec(`CREATE INDEX idx_notes_session ON notes(session_id)`);
}
