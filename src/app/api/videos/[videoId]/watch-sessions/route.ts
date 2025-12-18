import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { videos, watchSessions } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    try {
        const { videoId } = await params;
        const body = await request.json();
        const { sessionId, watchedSeconds, videoDuration } = body;

        if (!sessionId || watchedSeconds === undefined || !videoDuration) {
            return NextResponse.json(
                { error: 'missing_fields', message: 'sessionId, watchedSeconds, and videoDuration are required' },
                { status: 400 }
            );
        }

        // Check if video exists
        const video = await db.query.videos.findFirst({
            where: eq(videos.id, videoId),
        });

        if (!video) {
            return NextResponse.json(
                { error: 'not_found', message: 'Video not found' },
                { status: 404 }
            );
        }

        // Calculate watched percentage
        const watchedPercentage = Math.min(100, (watchedSeconds / videoDuration) * 100);

        // Find existing session
        const existingSession = await db.query.watchSessions.findFirst({
            where: and(
                eq(watchSessions.videoId, videoId),
                eq(watchSessions.sessionId, sessionId)
            ),
        });

        if (existingSession) {
            // Update if new max watched time
            if (watchedSeconds > existingSession.maxWatchedSeconds) {
                await db
                    .update(watchSessions)
                    .set({
                        maxWatchedSeconds: watchedSeconds,
                        watchedPercentage,
                    })
                    .where(eq(watchSessions.id, existingSession.id));
            }
        } else {
            // Create new session
            await db.insert(watchSessions).values({
                id: uuidv4(),
                videoId,
                sessionId,
                maxWatchedSeconds: watchedSeconds,
                durationSeconds: videoDuration,
                watchedPercentage,
                createdAt: new Date(),
            });
        }

        return NextResponse.json({ ok: true, watchedPercentage });
    } catch (error) {
        console.error('Watch session error:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
