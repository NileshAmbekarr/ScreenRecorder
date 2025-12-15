'use client';

import { useRef, useEffect, useState } from 'react';

interface BlobPreviewProps {
    blob: Blob;
    onDurationDetected?: (duration: number) => void;
}

export default function BlobPreview({ blob, onDurationDetected }: BlobPreviewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Create blob URL when blob changes
    useEffect(() => {
        const url = URL.createObjectURL(blob);
        console.log('Created blob URL:', url, 'for blob size:', blob.size);
        setBlobUrl(url);
        setIsLoading(true);
        setLoadError(null);

        return () => {
            console.log('Revoking blob URL:', url);
            URL.revokeObjectURL(url);
        };
    }, [blob]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const duration = videoRef.current.duration;
            console.log('Video metadata loaded, duration:', duration);

            // Handle infinite duration (common with webm)
            if (isFinite(duration) && duration > 0) {
                setVideoDuration(duration);
                onDurationDetected?.(duration);
            }
            setIsLoading(false);
        }
    };

    const handleCanPlay = () => {
        console.log('Video can play');
        setIsLoading(false);
    };

    const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        console.error('Video load error:', e);
        setLoadError('Failed to load video. The recording may be corrupted.');
        setIsLoading(false);
    };

    // Fix for webm duration detection - seek to end to get accurate duration
    const handleLoadedData = () => {
        if (videoRef.current) {
            const video = videoRef.current;

            // For webm files, sometimes we need to seek to get accurate duration
            if (!isFinite(video.duration) || video.duration === 0) {
                console.log('Duration not available, attempting to detect...');

                // Try seeking to a large number to trigger duration calculation
                video.currentTime = Number.MAX_SAFE_INTEGER;
            }
        }
    };

    const handleSeeked = () => {
        if (videoRef.current) {
            const video = videoRef.current;

            // After seeking to end, we should have the real duration
            if (isFinite(video.duration) && video.duration > 0 && videoDuration === null) {
                console.log('Duration detected after seek:', video.duration);
                setVideoDuration(video.duration);
                onDurationDetected?.(video.duration);
                // Reset to beginning
                video.currentTime = 0;
            }
        }
    };

    const handleDownload = () => {
        if (!blobUrl) return;

        // Create a fresh URL for download to avoid issues
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `recording-${Date.now()}.webm`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Cleanup after a short delay
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        }, 100);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="blob-preview">
            <h3>Recording Preview</h3>

            <div className="video-container">
                {isLoading && (
                    <div className="loading-overlay">
                        <span className="spinner" />
                        <span>Loading video...</span>
                    </div>
                )}

                {loadError && (
                    <div className="error-message">
                        <span className="error-icon">⚠️</span>
                        <span>{loadError}</span>
                    </div>
                )}

                {blobUrl && (
                    <video
                        ref={videoRef}
                        src={blobUrl}
                        controls
                        className="preview-video"
                        preload="auto"
                        onLoadedMetadata={handleLoadedMetadata}
                        onLoadedData={handleLoadedData}
                        onCanPlay={handleCanPlay}
                        onSeeked={handleSeeked}
                        onError={handleError}
                        playsInline
                    />
                )}
            </div>

            <div className="preview-info">
                <span className="file-size">Size: {formatFileSize(blob.size)}</span>
                <span className="file-type">Type: {blob.type || 'video/webm'}</span>
                {videoDuration !== null && (
                    <span className="file-duration">Duration: {formatDuration(videoDuration)}</span>
                )}
            </div>

            <div className="preview-actions">
                <button onClick={handleDownload} className="btn btn-secondary">
                    <span className="icon">💾</span>
                    Download Recording
                </button>
            </div>
        </div>
    );
}
