import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Video table
export const videos = sqliteTable('videos', {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull().default('video/webm'),
    durationSeconds: real('duration_seconds').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    publicUrl: text('public_url').notNull(),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Views table (for tracking video views)
export const views = sqliteTable('views', {
    id: text('id').primaryKey(),
    videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Watch sessions table (for tracking watch progress)
export const watchSessions = sqliteTable('watch_sessions', {
    id: text('id').primaryKey(),
    videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    maxWatchedSeconds: real('max_watched_seconds').notNull(),
    durationSeconds: real('duration_seconds').notNull(),
    watchedPercentage: real('watched_percentage').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Type exports for use in application code
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type View = typeof views.$inferSelect;
export type NewView = typeof views.$inferInsert;
export type WatchSession = typeof watchSessions.$inferSelect;
export type NewWatchSession = typeof watchSessions.$inferInsert;
