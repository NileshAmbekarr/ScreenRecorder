import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videos, views, watchSessions } from '@/lib/schema';
import { eq, avg } from 'drizzle-orm';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    try {
        const { videoId } = await params;

        // Find video
        const video = await db.query.videos.findFirst({
            where: eq(videos.id, videoId),
        });

        if (!video) {
            return NextResponse.json(
                { error: 'not_found', message: 'Video not found' },
                { status: 404 }
            );
        }

        // Get average watch percentage
        const watchStats = await db
            .select({ avgPercentage: avg(watchSessions.watchedPercentage) })
            .from(watchSessions)
            .where(eq(watchSessions.videoId, videoId));

        const avgWatchPercentage = watchStats[0]?.avgPercentage ?? 0;

        return NextResponse.json({
            video: {
                id: video.id,
                filename: video.filename,
                contentType: video.contentType,
                durationSeconds: video.durationSeconds,
                sizeBytes: video.sizeBytes,
                publicUrl: video.publicUrl,
                viewCount: video.viewCount,
                createdAt: video.createdAt,
            },
            analytics: {
                viewCount: video.viewCount,
                avgWatchPercentage: Number(avgWatchPercentage),
            },
        });
    } catch (error) {
        console.error('Get video error:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
