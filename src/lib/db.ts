import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Turso/LibSQL configuration
// For production: Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
// For local development: Uses local file if TURSO_DATABASE_URL is not set
const isProduction = !!process.env.TURSO_DATABASE_URL;

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create Drizzle ORM instance
export const db = drizzle(client, { schema });

// Initialize database tables (runs on first import)
async function initializeDatabase() {
  try {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'video/webm',
        duration_seconds REAL NOT NULL,
        size_bytes INTEGER NOT NULL,
        public_url TEXT NOT NULL,
        view_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS views (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watch_sessions (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        max_watched_seconds REAL NOT NULL,
        duration_seconds REAL NOT NULL,
        watched_percentage REAL NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_views_video_session ON views(video_id, session_id);
      CREATE INDEX IF NOT EXISTS idx_watch_sessions_video ON watch_sessions(video_id);
    `);
    console.log(`Database initialized (${isProduction ? 'Turso' : 'Local SQLite'})`);
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize on module load
initializeDatabase();

export default db;
