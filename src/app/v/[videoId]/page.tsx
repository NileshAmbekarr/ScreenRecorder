import prisma from '@/lib/db';
import PublicPlayer from '@/components/PublicPlayer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
    params: Promise<{ videoId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { videoId } = await params;
    const video = await prisma.video.findUnique({ where: { id: videoId } });

    if (!video) {
        return { title: 'Video Not Found' };
    }

    return {
        title: `Watch Recording - Screen Recorder`,
        description: `Watch this ${Math.round(video.durationSeconds)} second screen recording`,
        openGraph: {
            title: 'Screen Recording',
            description: `Watch this ${Math.round(video.durationSeconds)} second screen recording`,
            type: 'video.other',
        },
    };
}

export default async function WatchPage({ params }: PageProps) {
    const { videoId } = await params;

    const video = await prisma.video.findUnique({
        where: { id: videoId },
    });

    if (!video) {
        notFound();
    }

    // Calculate average watch percentage
    const watchStats = await prisma.watchSession.aggregate({
        where: { videoId },
        _avg: { watchedPercentage: true },
    });

    return (
        <main className="watch-page">
            <header className="watch-header">
                <a href="/" className="back-link">
                    <span className="logo-icon">🎬</span>
                    <span>Screen Recorder</span>
                </a>
            </header>

            <div className="watch-content">
                <PublicPlayer
                    videoId={video.id}
                    publicUrl={video.publicUrl}
                    duration={video.durationSeconds}
                    viewCount={video.viewCount}
                    avgWatchPct={watchStats._avg.watchedPercentage || 0}
                />
            </div>

            <footer className="watch-footer">
                <p>
                    Recorded with{' '}
                    <a href="/" className="footer-link">Screen Recorder</a>
                </p>
            </footer>
        </main>
    );
}
