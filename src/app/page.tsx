'use client';

import { useState, useCallback } from 'react';
import RecorderPanel from '@/components/RecorderPanel';
import BlobPreview from '@/components/BlobPreview';
import Trimmer from '@/components/Trimmer';
import Uploader from '@/components/Uploader';

type Stage = 'recording' | 'preview' | 'uploaded';

interface RecordingData {
  blob: Blob;
  duration: number;
}

interface TrimData {
  startTime: number;
  endTime: number;
}

interface UploadResult {
  videoId: string;
  publicUrl: string;
  watchPageUrl: string;
  duration: number;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('recording');
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null);
  const [trimData, setTrimData] = useState<TrimData>({ startTime: 0, endTime: 0 });
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    console.log('Recording complete, blob size:', blob.size, 'estimated duration:', duration);
    setRecordingData({ blob, duration: duration || 10 }); // Default to 10 if duration is 0
    setTrimData({ startTime: 0, endTime: duration || 10 });
    setStage('preview');
  };

  // Update duration when BlobPreview detects the actual duration
  const handleDurationDetected = useCallback((detectedDuration: number) => {
    console.log('Actual duration detected:', detectedDuration);
    if (detectedDuration > 0) {
      setRecordingData(prev => prev ? { ...prev, duration: detectedDuration } : null);
      setTrimData(prev => ({
        startTime: prev.startTime,
        endTime: Math.min(prev.endTime, detectedDuration) || detectedDuration
      }));
    }
  }, []);

  const handleTrimChange = useCallback((startTime: number, endTime: number) => {
    setTrimData({ startTime, endTime });
  }, []);

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
    setStage('uploaded');
  };

  const startNewRecording = () => {
    if (stage === 'preview' && recordingData) {
      const confirmed = window.confirm(
        'Are you sure you want to start a new recording? You will lose the current recording.'
      );
      if (!confirmed) return;
    }
    setRecordingData(null);
    setUploadResult(null);
    setTrimData({ startTime: 0, endTime: 0 });
    setStage('recording');
  };

  return (
    <main className="main-container">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🎬</span>
          <h1>Screen Recorder</h1>
        </div>
        <p className="tagline">Record, trim, and share your screen in seconds</p>
      </header>

      <div className="content-wrapper">
        {stage === 'recording' && (
          <RecorderPanel onRecordingComplete={handleRecordingComplete} />
        )}

        {stage === 'preview' && recordingData && (
          <div className="preview-stage">
            <div className="stage-header">
              <h2>Edit Your Recording</h2>
              <button onClick={startNewRecording} className="btn btn-ghost">
                ← Start New Recording
              </button>
            </div>

            <div className="preview-grid">
              <div className="preview-section">
                <BlobPreview
                  blob={recordingData.blob}
                  onDurationDetected={handleDurationDetected}
                />
              </div>

              <div className="trim-section">
                <Trimmer
                  blob={recordingData.blob}
                  duration={recordingData.duration}
                  onTrimChange={handleTrimChange}
                />
              </div>

              <div className="upload-section">
                <Uploader
                  blob={recordingData.blob}
                  startTime={trimData.startTime}
                  endTime={trimData.endTime}
                  onUploadComplete={handleUploadComplete}
                />
              </div>
            </div>
          </div>
        )}

        {stage === 'uploaded' && uploadResult && (
          <div className="success-stage">
            <div className="success-content">
              <div className="success-icon-large">🎉</div>
              <h2>Your video is ready!</h2>
              <p>Share it with anyone using the link below</p>

              <div className="share-box">
                <input
                  type="text"
                  value={uploadResult.watchPageUrl}
                  readOnly
                  className="share-input"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(uploadResult.watchPageUrl)}
                  className="btn btn-primary"
                >
                  Copy Link
                </button>
              </div>

              <div className="success-actions">
                <a
                  href={uploadResult.watchPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  View Video
                </a>
                <button onClick={startNewRecording} className="btn btn-ghost">
                  Record Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="app-footer">
        <p>Best experience in Chrome or Edge • Videos stored locally</p>
      </footer>
    </main>
  );
}
