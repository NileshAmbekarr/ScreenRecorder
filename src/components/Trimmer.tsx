'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface TrimmerProps {
    blob: Blob;
    duration: number;
    onTrimChange: (startTime: number, endTime: number) => void;
}

export default function Trimmer({ blob, duration, onTrimChange }: TrimmerProps) {
    // Ensure we have a valid duration
    const safeDuration = duration > 0 ? duration : 1;

    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(safeDuration);
    const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
    const [currentPreviewTime, setCurrentPreviewTime] = useState(0);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    // Controlled input values (as strings for proper editing)
    const [startInputValue, setStartInputValue] = useState('0.00');
    const [endInputValue, setEndInputValue] = useState(safeDuration.toFixed(2));

    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    // Create blob URL
    useEffect(() => {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [blob]);

    // Update end time when duration changes
    useEffect(() => {
        if (duration > 0) {
            setEndTime(duration);
            setEndInputValue(duration.toFixed(2));
        }
    }, [duration]);

    // Notify parent of trim changes
    useEffect(() => {
        onTrimChange(startTime, endTime);
    }, [startTime, endTime, onTrimChange]);

    // Update input values when times change (from dragging)
    useEffect(() => {
        setStartInputValue(startTime.toFixed(2));
    }, [startTime]);

    useEffect(() => {
        setEndInputValue(endTime.toFixed(2));
    }, [endTime]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const getPositionFromTime = (time: number): number => {
        if (safeDuration <= 0) return 0;
        return Math.min(100, Math.max(0, (time / safeDuration) * 100));
    };

    const getTimeFromPosition = useCallback((clientX: number): number => {
        if (!timelineRef.current) return 0;
        const rect = timelineRef.current.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return position * safeDuration;
    }, [safeDuration]);

    // Mouse/Touch event handlers for dragging
    const handleDragStart = (handle: 'start' | 'end') => (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(handle);
    };

    const handleDragMove = useCallback((clientX: number) => {
        if (!isDragging) return;

        const time = getTimeFromPosition(clientX);

        if (isDragging === 'start') {
            const newStart = Math.max(0, Math.min(time, endTime - 0.1));
            setStartTime(newStart);
        } else {
            const newEnd = Math.min(safeDuration, Math.max(time, startTime + 0.1));
            setEndTime(newEnd);
        }
    }, [isDragging, startTime, endTime, safeDuration, getTimeFromPosition]);

    const handleDragEnd = useCallback(() => {
        setIsDragging(null);
    }, []);

    // Global mouse/touch event listeners for dragging
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            handleDragMove(e.clientX);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                handleDragMove(e.touches[0].clientX);
            }
        };

        const handleEnd = () => {
            handleDragEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Input handlers - allow free typing, validate on blur
    const handleStartInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartInputValue(e.target.value);
    };

    const handleStartInputBlur = () => {
        const value = parseFloat(startInputValue);
        if (!isNaN(value) && value >= 0 && value < endTime) {
            setStartTime(value);
        } else {
            // Reset to current valid value
            setStartInputValue(startTime.toFixed(2));
        }
    };

    const handleEndInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndInputValue(e.target.value);
    };

    const handleEndInputBlur = () => {
        const value = parseFloat(endInputValue);
        if (!isNaN(value) && value > startTime && value <= safeDuration) {
            setEndTime(value);
        } else {
            // Reset to current valid value
            setEndInputValue(endTime.toFixed(2));
        }
    };

    // Handle Enter key in inputs
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'start' | 'end') => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only handle click if not dragging
        if (isDragging) return;

        const target = e.target as HTMLElement;
        // Don't handle clicks on handles
        if (target.closest('.timeline-handle')) return;

        const time = getTimeFromPosition(e.clientX);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentPreviewTime(time);
        }
    };

    const previewTrimmedRegion = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = startTime;
            videoRef.current.play();
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            setCurrentPreviewTime(currentTime);
            // Stop at end time during preview
            if (currentTime >= endTime) {
                videoRef.current.pause();
                videoRef.current.currentTime = endTime;
            }
        }
    };

    const trimmedDuration = Math.max(0, endTime - startTime);

    return (
        <div className="trimmer">
            <h3>Trim Video</h3>

            <div className="trimmer-preview">
                {blobUrl && (
                    <video
                        ref={videoRef}
                        src={blobUrl}
                        onTimeUpdate={handleTimeUpdate}
                        className="trim-video"
                        preload="auto"
                        controls
                    />
                )}
            </div>

            <div
                className={`timeline ${isDragging ? 'dragging' : ''}`}
                ref={timelineRef}
                onClick={handleTimelineClick}
            >
                {/* Selected region */}
                <div
                    className="timeline-track"
                    style={{
                        left: `${getPositionFromTime(startTime)}%`,
                        width: `${getPositionFromTime(endTime) - getPositionFromTime(startTime)}%`
                    }}
                />

                {/* Start handle */}
                <div
                    className="timeline-handle start-handle"
                    style={{ left: `${getPositionFromTime(startTime)}%` }}
                    onMouseDown={handleDragStart('start')}
                    onTouchStart={handleDragStart('start')}
                >
                    <div className="handle-bar" />
                    <div className="handle-label">{formatTime(startTime)}</div>
                </div>

                {/* End handle */}
                <div
                    className="timeline-handle end-handle"
                    style={{ left: `${getPositionFromTime(endTime)}%` }}
                    onMouseDown={handleDragStart('end')}
                    onTouchStart={handleDragStart('end')}
                >
                    <div className="handle-bar" />
                    <div className="handle-label">{formatTime(endTime)}</div>
                </div>

                {/* Playhead */}
                <div
                    className="playhead"
                    style={{ left: `${getPositionFromTime(currentPreviewTime)}%` }}
                />
            </div>

            <div className="time-labels">
                <span>Start: {formatTime(startTime)}</span>
                <span className="duration-label">Selection: {formatTime(trimmedDuration)}</span>
                <span>End: {formatTime(endTime)}</span>
            </div>

            <div className="time-inputs">
                <div className="input-group">
                    <label htmlFor="start-time-input">Start Time (seconds):</label>
                    <input
                        id="start-time-input"
                        type="text"
                        inputMode="decimal"
                        value={startInputValue}
                        onChange={handleStartInputChange}
                        onBlur={handleStartInputBlur}
                        onKeyDown={(e) => handleInputKeyDown(e, 'start')}
                        className="time-input"
                        placeholder="0.00"
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="end-time-input">End Time (seconds):</label>
                    <input
                        id="end-time-input"
                        type="text"
                        inputMode="decimal"
                        value={endInputValue}
                        onChange={handleEndInputChange}
                        onBlur={handleEndInputBlur}
                        onKeyDown={(e) => handleInputKeyDown(e, 'end')}
                        className="time-input"
                        placeholder={safeDuration.toFixed(2)}
                    />
                </div>
            </div>

            <div className="trimmer-actions">
                <button onClick={previewTrimmedRegion} className="btn btn-secondary">
                    <span className="icon">▶️</span>
                    Preview Trim
                </button>
            </div>
        </div>
    );
}
