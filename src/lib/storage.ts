import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * Ensures the upload directories exist
 */
export async function ensureUploadDirs(): Promise<void> {
    const rawDir = path.join(UPLOAD_DIR, 'raw');
    const videosDir = path.join(UPLOAD_DIR, 'videos');

    await fs.mkdir(rawDir, { recursive: true });
    await fs.mkdir(videosDir, { recursive: true });
}

/**
 * Saves a raw video file before processing
 */
export async function saveRawVideo(videoId: string, buffer: Buffer): Promise<string> {
    await ensureUploadDirs();
    const filePath = path.join(UPLOAD_DIR, 'raw', `${videoId}.webm`);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

/**
 * Gets the path where the final video should be saved
 */
export function getFinalVideoPath(videoId: string): string {
    return path.join(UPLOAD_DIR, 'videos', `${videoId}.webm`);
}

/**
 * Gets the absolute path for serving a video
 */
export function getVideoAbsolutePath(videoId: string): string {
    return path.resolve(UPLOAD_DIR, 'videos', `${videoId}.webm`);
}

/**
 * Gets the public URL for a video
 */
export function getPublicUrl(videoId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/uploads/videos/${videoId}.webm`;
}

/**
 * Deletes a raw video file after processing
 */
export async function deleteRawVideo(videoId: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, 'raw', `${videoId}.webm`);
    try {
        await fs.unlink(filePath);
    } catch (error) {
        // Ignore if file doesn't exist
        console.warn(`Could not delete raw video ${videoId}:`, error);
    }
}

/**
 * Gets video file stats
 */
export async function getVideoStats(videoId: string): Promise<{ size: number } | null> {
    const filePath = getVideoAbsolutePath(videoId);
    try {
        const stats = await fs.stat(filePath);
        return { size: stats.size };
    } catch {
        return null;
    }
}

/**
 * Reads a video file for streaming
 */
export async function readVideoFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
}

/**
 * Checks if a video exists
 */
export async function videoExists(videoId: string): Promise<boolean> {
    const filePath = getVideoAbsolutePath(videoId);
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}
