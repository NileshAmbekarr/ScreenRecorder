import { spawn } from 'child_process';
import path from 'path';

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

interface FFmpegResult {
    success: boolean;
    error?: string;
}

/**
 * Trims a video using FFmpeg with copy codec (fast, no re-encoding)
 * @param inputPath - Path to the input video file
 * @param outputPath - Path for the output video file
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 */
export async function trimVideo(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number
): Promise<FFmpegResult> {
    const duration = endTime - startTime;

    // Using -ss before -i for fast seeking (keyframe accurate)
    // Using -c copy to avoid re-encoding (fast but may have slight imprecision at cut points)
    const args = [
        '-y', // Overwrite output file if exists
        '-ss', startTime.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-c', 'copy',
        outputPath
    ];

    return new Promise((resolve) => {
        const ffmpeg = spawn(FFMPEG_PATH, args);

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                console.error('FFmpeg error:', errorOutput);
                resolve({ success: false, error: `FFmpeg exited with code ${code}: ${errorOutput.slice(-500)}` });
            }
        });

        ffmpeg.on('error', (err) => {
            resolve({ success: false, error: `Failed to start FFmpeg: ${err.message}` });
        });
    });
}

/**
 * Gets the duration of a video file using ffprobe
 */
export async function getVideoDuration(filePath: string): Promise<number | null> {
    const ffprobePath = FFMPEG_PATH.replace('ffmpeg', 'ffprobe');

    const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
    ];

    return new Promise((resolve) => {
        const ffprobe = spawn(ffprobePath, args);

        let output = '';
        let errorOutput = '';

        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0 && output.trim()) {
                const duration = parseFloat(output.trim());
                resolve(isNaN(duration) ? null : duration);
            } else {
                console.error('FFprobe error:', errorOutput);
                resolve(null);
            }
        });

        ffprobe.on('error', (err) => {
            console.error('Failed to start ffprobe:', err);
            resolve(null);
        });
    });
}

/**
 * Copies a file using FFmpeg (for when no trimming is needed)
 */
export async function copyVideo(inputPath: string, outputPath: string): Promise<FFmpegResult> {
    const args = [
        '-y',
        '-i', inputPath,
        '-c', 'copy',
        outputPath
    ];

    return new Promise((resolve) => {
        const ffmpeg = spawn(FFMPEG_PATH, args);

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: `FFmpeg copy failed with code ${code}` });
            }
        });

        ffmpeg.on('error', (err) => {
            resolve({ success: false, error: `Failed to start FFmpeg: ${err.message}` });
        });
    });
}
