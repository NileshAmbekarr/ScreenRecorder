import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    try {
        const { videoId } = await params;
        const body = await request.json();
        const { sessionId, maxWatchedSeconds, durationSeconds } = body;

        if (!sessionId || maxWatchedSeconds === undefined || !durationSeconds) {
            return NextResponse.json(
                { error: 'missing_fields', message: 'sessionId, maxWatchedSeconds, and durationSeconds are required' },
                { status: 400 }
            );
        }

        // Check if video exists
        const video = await prisma.video.findUnique({
            where: { id: videoId },
        });

        if (!video) {
            return NextResponse.json(
                { error: 'not_found', message: 'Video not found' },
                { status: 404 }
            );
        }

        // Calculate watched percentage
        const watchedPercentage = Math.min(100, (maxWatchedSeconds / durationSeconds) * 100);

        // Check for existing session to update instead of creating duplicate
        const existingSession = await prisma.watchSession.findFirst({
            where: { videoId, sessionId },
            orderBy: { createdAt: 'desc' },
        });

        if (existingSession) {
            // Update if current watch is longer
            if (maxWatchedSeconds > existingSession.maxWatchedSeconds) {
                await prisma.watchSession.update({
                    where: { id: existingSession.id },
                    data: {
                        maxWatchedSeconds,
                        watchedPercentage,
                    },
                });
            }
        } else {
            // Create new watch session
            await prisma.watchSession.create({
                data: {
                    videoId,
                    sessionId,
                    maxWatchedSeconds,
                    durationSeconds,
                    watchedPercentage,
                },
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
