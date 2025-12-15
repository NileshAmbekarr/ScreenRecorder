import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

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
        const video = await prisma.video.findUnique({
            where: { id: videoId },
        });

        if (!video) {
            return NextResponse.json(
                { error: 'not_found', message: 'Video not found' },
                { status: 404 }
            );
        }

        // Check for duplicate view within dedup window
        const cutoffTime = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
        const existingView = await prisma.view.findFirst({
            where: {
                videoId,
                sessionId,
                createdAt: { gte: cutoffTime },
            },
        });

        if (existingView) {
            // Already counted this view recently
            return NextResponse.json({ ok: true, deduplicated: true });
        }

        // Get user agent from request headers
        const userAgent = request.headers.get('user-agent') || undefined;

        // Create view record and increment view count
        await prisma.$transaction([
            prisma.view.create({
                data: {
                    videoId,
                    sessionId,
                    userAgent,
                },
            }),
            prisma.video.update({
                where: { id: videoId },
                data: { viewCount: { increment: 1 } },
            }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('View tracking error:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
