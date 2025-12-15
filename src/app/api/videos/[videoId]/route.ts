import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    try {
        const { videoId } = await params;

        const video = await prisma.video.findUnique({
            where: { id: videoId },
        });

        if (!video) {
            return NextResponse.json(
                { error: 'not_found', message: 'Video not found' },
                { status: 404 }
            );
        }

        // Calculate average watch percentage
        const watchStats = await prisma.watchSession.aggregate({
            where: { videoId },
            _avg: { watchedPercentage: true },
            _count: true,
        });

        return NextResponse.json({
            videoId: video.id,
            publicUrl: video.publicUrl,
            duration: video.durationSeconds,
            sizeBytes: video.sizeBytes,
            viewCount: video.viewCount,
            avgWatchPct: watchStats._avg.watchedPercentage || 0,
            watchSessionCount: watchStats._count,
            createdAt: video.createdAt,
        });
    } catch (error) {
        console.error('Get video error:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
