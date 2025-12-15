'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface RecorderPanelProps {
    onRecordingComplete: (blob: Blob, duration: number) => void;
}

export default function RecorderPanel({ onRecordingComplete }: RecorderPanelProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    // Use ref for duration to avoid closure issues
    const elapsedTimeRef = useRef<number>(0);

    const formatTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startTimer = useCallback(() => {
        startTimeRef.current = Date.now();
        elapsedTimeRef.current = 0;
        setElapsedTime(0);

        timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            elapsedTimeRef.current = elapsed;
            setElapsedTime(elapsed);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const cleanupStreams = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
    }, []);

    const startRecording = async () => {
        setError(null);
        setPermissionStatus('requesting');
        chunksRef.current = [];

        try {
            // Request screen capture with audio
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'monitor',
                },
                audio: true,
            });
            streamRef.current = displayStream;

            // Request microphone audio
            let micStream: MediaStream | null = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStreamRef.current = micStream;
            } catch (micError) {
                console.warn('Microphone access denied or unavailable:', micError);
            }

            // Combine streams
            const tracks = [...displayStream.getVideoTracks()];

            // Add audio tracks - prefer system audio from display stream
            const displayAudioTracks = displayStream.getAudioTracks();
            if (displayAudioTracks.length > 0) {
                tracks.push(...displayAudioTracks);
            }

            // Add microphone audio if available
            if (micStream) {
                tracks.push(...micStream.getAudioTracks());
            }

            const combinedStream = new MediaStream(tracks);

            // Handle stream ending (user clicks "Stop sharing" in browser)
            displayStream.getVideoTracks()[0].onended = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
            };

            // Determine best mime type
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                mimeType = 'video/webm;codecs=vp9,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                mimeType = 'video/webm;codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
            }

            console.log('Using mimeType:', mimeType);

            const mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: 2500000, // 2.5 Mbps
            });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                console.log('Data available:', event.data.size, 'bytes');
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                console.log('Recording stopped, chunks:', chunksRef.current.length);
                stopTimer();

                // Get duration from ref (not stale closure)
                const duration = elapsedTimeRef.current;

                if (chunksRef.current.length === 0) {
                    setError('Recording failed: No data was captured.');
                    cleanupStreams();
                    return;
                }

                // Create blob from chunks
                const blob = new Blob(chunksRef.current, { type: mimeType });
                console.log('Created blob:', blob.size, 'bytes, type:', blob.type);

                cleanupStreams();
                setIsRecording(false);
                setIsPaused(false);

                // Pass to parent
                onRecordingComplete(blob, duration);
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                setError('Recording failed due to an error.');
                cleanupStreams();
            };

            // Start recording WITHOUT timeslice for better compatibility
            // Data will be collected all at once when stop() is called
            mediaRecorder.start();
            console.log('Recording started');

            setIsRecording(true);
            setPermissionStatus('granted');
            startTimer();
        } catch (err) {
            console.error('Recording error:', err);
            setPermissionStatus('denied');
            cleanupStreams();

            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    setError('Recording cancelled: please allow screen and mic access.');
                } else if (err.name === 'NotFoundError') {
                    setError('No screen or microphone found.');
                } else {
                    setError(`Recording failed: ${err.message}`);
                }
            } else {
                setError('An unknown error occurred while starting the recording.');
            }
        }
    };

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log('Stopping recording...');
            mediaRecorderRef.current.stop();
        }
    }, []);

    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            stopTimer();
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            // Resume timer from where we left off
            const currentElapsed = elapsedTimeRef.current;
            startTimeRef.current = Date.now() - (currentElapsed * 1000);
            timerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                elapsedTimeRef.current = elapsed;
                setElapsedTime(elapsed);
            }, 1000);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopTimer();
            cleanupStreams();
        };
    }, [stopTimer, cleanupStreams]);

    return (
        <div className="recorder-panel">
            <div className="recorder-header">
                <h2>Screen Recorder</h2>
                <p className="subtitle">Record your screen with microphone audio</p>
            </div>

            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="dismiss-btn">×</button>
                </div>
            )}

            {isRecording && (
                <div className="recording-indicator">
                    <div className={`recording-dot ${isPaused ? 'paused' : 'active'}`} />
                    <span className="timer">{formatTime(elapsedTime)}</span>
                    {isPaused && <span className="paused-label">PAUSED</span>}
                </div>
            )}

            <div className="controls">
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        className="btn btn-primary btn-large"
                        disabled={permissionStatus === 'requesting'}
                    >
                        {permissionStatus === 'requesting' ? (
                            <>
                                <span className="spinner" />
                                Requesting access...
                            </>
                        ) : (
                            <>
                                <span className="icon">🔴</span>
                                Start Recording
                            </>
                        )}
                    </button>
                ) : (
                    <div className="recording-controls">
                        {isPaused ? (
                            <button onClick={resumeRecording} className="btn btn-secondary">
                                <span className="icon">▶️</span>
                                Resume
                            </button>
                        ) : (
                            <button onClick={pauseRecording} className="btn btn-secondary">
                                <span className="icon">⏸️</span>
                                Pause
                            </button>
                        )}
                        <button onClick={stopRecording} className="btn btn-danger">
                            <span className="icon">⏹️</span>
                            Stop Recording
                        </button>
                    </div>
                )}
            </div>

            <div className="browser-support-notice">
                <p>Best supported in Chrome and Edge. Firefox has limited audio support.</p>
            </div>
        </div>
    );
}
