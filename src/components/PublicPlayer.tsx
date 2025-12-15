'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PublicPlayerProps {
    videoId: string;
    publicUrl: string;
    duration: number;
    viewCount: number;
    avgWatchPct: number;
}

export default function PublicPlayer({
    videoId,
    publicUrl,
    duration,
    viewCount,
    avgWatchPct
}: PublicPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [maxWatched, setMaxWatched] = useState(0);
    const [hasTrackedView, setHasTrackedView] = useState(false);
    const sessionIdRef = useRef<string>('');

    // Get or create session ID
    useEffect(() => {
        let sessionId = localStorage.getItem('viewerSessionId');
        if (!sessionId) {
            sessionId = crypto.randomUUID();
            localStorage.setItem('viewerSessionId', sessionId);
        }
        sessionIdRef.current = sessionId;
    }, []);

    // Track view on mount
    useEffect(() => {
        if (!hasTrackedView && sessionIdRef.current) {
            fetch(`/api/videos/${videoId}/views`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionIdRef.current }),
            }).catch(console.error);
            setHasTrackedView(true);
        }
    }, [videoId, hasTrackedView]);

    // Track watch progress
    const sendWatchSession = useCallback(() => {
        if (maxWatched > 0 && sessionIdRef.current) {
            fetch(`/api/videos/${videoId}/watch-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    maxWatchedSeconds: maxWatched,
                    durationSeconds: duration,
                }),
            }).catch(console.error);
        }
    }, [videoId, maxWatched, duration]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            if (currentTime > maxWatched) {
                setMaxWatched(currentTime);
            }
        }
    };

    const handleEnded = () => {
        sendWatchSession();
    };

    // Send watch session on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            sendWatchSession();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Also send when component unmounts
            sendWatchSession();
        };
    }, [sendWatchSession]);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="public-player">
            <div className="video-wrapper">
                <video
                    ref={videoRef}
                    src={publicUrl}
                    controls
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    className="main-video"
                    preload="metadata"
                />
            </div>

            <div className="video-stats">
                <div className="stat">
                    <span className="stat-icon">👁️</span>
                    <span className="stat-value">{viewCount.toLocaleString()}</span>
                    <span className="stat-label">{viewCount === 1 ? 'view' : 'views'}</span>
                </div>

                <div className="stat">
                    <span className="stat-icon">⏱️</span>
                    <span className="stat-value">{formatDuration(duration)}</span>
                    <span className="stat-label">duration</span>
                </div>

                <div className="stat">
                    <span className="stat-icon">📊</span>
                    <span className="stat-value">{avgWatchPct.toFixed(0)}%</span>
                    <span className="stat-label">avg. watched</span>
                </div>
            </div>
        </div>
    );
}
