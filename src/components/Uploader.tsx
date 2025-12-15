'use client';

import { useState, useCallback } from 'react';

interface UploaderProps {
    blob: Blob;
    startTime: number;
    endTime: number;
    onUploadComplete: (result: {
        videoId: string;
        publicUrl: string;
        watchPageUrl: string;
        duration: number;
    }) => void;
}

export default function Uploader({ blob, startTime, endTime, onUploadComplete }: UploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        videoId: string;
        publicUrl: string;
        watchPageUrl: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const handleUpload = async () => {
        setError(null);
        setIsUploading(true);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', blob, 'recording.webm');
            formData.append('startTime', startTime.toString());
            formData.append('endTime', endTime.toString());

            // Simulate progress for now (XHR would give real progress)
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const response = await fetch('/api/videos/upload-raw', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setProgress(100);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            const data = await response.json();
            setResult({
                videoId: data.videoId,
                publicUrl: data.publicUrl,
                watchPageUrl: data.watchPageUrl,
            });
            onUploadComplete(data);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const copyToClipboard = useCallback(async () => {
        if (result?.watchPageUrl) {
            try {
                await navigator.clipboard.writeText(result.watchPageUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    }, [result]);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="uploader">
            <h3>Upload Video</h3>

            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="dismiss-btn">×</button>
                </div>
            )}

            {!result ? (
                <>
                    <div className="upload-info">
                        <p>
                            <strong>File size:</strong> {formatFileSize(blob.size)}
                        </p>
                        <p>
                            <strong>Trim range:</strong> {startTime.toFixed(2)}s - {endTime.toFixed(2)}s
                        </p>
                    </div>

                    {isUploading && (
                        <div className="progress-container">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="progress-text">{progress}%</span>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="btn btn-primary btn-large"
                    >
                        {isUploading ? (
                            <>
                                <span className="spinner" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <span className="icon">☁️</span>
                                Upload & Process
                            </>
                        )}
                    </button>
                </>
            ) : (
                <div className="upload-success">
                    <div className="success-icon">✅</div>
                    <h4>Upload Complete!</h4>
                    <p>Your video is ready to share.</p>

                    <div className="share-link-container">
                        <input
                            type="text"
                            value={result.watchPageUrl}
                            readOnly
                            className="share-link-input"
                        />
                        <button
                            onClick={copyToClipboard}
                            className="btn btn-secondary copy-btn"
                        >
                            {copied ? '✓ Copied!' : '📋 Copy Link'}
                        </button>
                    </div>

                    <a
                        href={result.watchPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                    >
                        <span className="icon">🔗</span>
                        Open Watch Page
                    </a>
                </div>
            )}
        </div>
    );
}
