import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { videos, views } from '@/lib/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// Deduplication window in hours
const DEDUP_HOURS = 24;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    try {
        const { videoId } = await params;
        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'missing_session_id', message: 'sessionId is required' },
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

        // Check for duplicate view within dedup window
        const cutoffTime = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
        const existingView = await db.query.views.findFirst({
            where: and(
                eq(views.videoId, videoId),
                eq(views.sessionId, sessionId),
                gte(views.createdAt, cutoffTime)
            ),
        });

        if (existingView) {
            // Already counted this view recently
            return NextResponse.json({ ok: true, deduplicated: true });
        }

        // Get user agent from request headers
        const userAgent = request.headers.get('user-agent') || undefined;

        // Create view record
        await db.insert(views).values({
            id: uuidv4(),
            videoId,
            sessionId,
            userAgent,
            createdAt: new Date(),
        });

        // Increment view count
        await db
            .update(videos)
            .set({ viewCount: sql`${videos.viewCount} + 1` })
            .where(eq(videos.id, videoId));

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('View tracking error:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
