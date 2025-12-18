import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';

// Check if R2/S3 is configured
const isCloudStorage = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID);

// S3/R2 client configuration
const s3Client = isCloudStorage
    ? new S3Client({
        region: 'auto',
        endpoint: process.env.S3_ENDPOINT!,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
    })
    : null;

const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
const PUBLIC_URL = process.env.S3_PUBLIC_URL || '';
const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

console.log(`Storage mode: ${isCloudStorage ? 'R2/S3 Cloud' : 'Local filesystem'}`);

// ============ Directory Management ============

export async function ensureUploadDirs(): Promise<void> {
    // Always create local directories - FFmpeg needs them for processing
    const rawDir = path.join(LOCAL_UPLOAD_DIR, 'raw');
    const videosDir = path.join(LOCAL_UPLOAD_DIR, 'videos');
    await fs.mkdir(rawDir, { recursive: true });
    await fs.mkdir(videosDir, { recursive: true });
}

// ============ Raw Video (Temporary) ============

export async function saveRawVideo(videoId: string, buffer: Buffer): Promise<string> {
    // Always save raw files locally (they're temporary)
    await ensureUploadDirs();
    const filePath = path.join(LOCAL_UPLOAD_DIR, 'raw', `${videoId}.webm`);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

export async function deleteRawVideo(videoId: string): Promise<void> {
    const filePath = path.join(LOCAL_UPLOAD_DIR, 'raw', `${videoId}.webm`);
    try {
        await fs.unlink(filePath);
    } catch (error) {
        console.warn(`Could not delete raw video ${videoId}:`, error);
    }
}

// ============ Final Video Storage ============

export function getFinalVideoPath(videoId: string): string {
    // Always return local path - FFmpeg needs a local file to write to
    // If R2 is configured, saveFinalVideo will upload it afterwards
    return path.join(LOCAL_UPLOAD_DIR, 'videos', `${videoId}.webm`);
}

export async function saveFinalVideo(videoId: string, localPath: string): Promise<void> {
    const key = `videos/${videoId}.webm`;

    if (isCloudStorage && s3Client) {
        // Upload to R2/S3
        const fileBuffer = await fs.readFile(localPath);

        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: fileBuffer,
                ContentType: 'video/webm',
            })
        );
        console.log(`Uploaded to R2: ${key}`);

        // Delete local temp file after successful upload
        try {
            await fs.unlink(localPath);
            console.log(`Deleted local temp file: ${localPath}`);
        } catch (error) {
            console.warn(`Could not delete local temp file: ${localPath}`, error);
        }
    } else {
        // For local storage, file is already in place after FFmpeg processing
        console.log(`Saved locally: ${localPath}`);
    }
}

export function getPublicUrl(videoId: string): string {
    if (isCloudStorage) {
        // R2 public URL
        return `${PUBLIC_URL}/videos/${videoId}.webm`;
    }
    // Local: serve through API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/uploads/videos/${videoId}.webm`;
}

// ============ Video Access ============

export function getVideoAbsolutePath(videoId: string): string {
    return path.resolve(LOCAL_UPLOAD_DIR, 'videos', `${videoId}.webm`);
}

export async function videoExists(videoId: string): Promise<boolean> {
    const key = `videos/${videoId}.webm`;

    if (isCloudStorage && s3Client) {
        try {
            await s3Client.send(
                new HeadObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                })
            );
            return true;
        } catch {
            return false;
        }
    } else {
        const filePath = getVideoAbsolutePath(videoId);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

export async function getVideoStats(videoId: string): Promise<{ size: number } | null> {
    if (isCloudStorage && s3Client) {
        try {
            const response = await s3Client.send(
                new HeadObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: `videos/${videoId}.webm`,
                })
            );
            return { size: response.ContentLength || 0 };
        } catch {
            return null;
        }
    } else {
        const filePath = getVideoAbsolutePath(videoId);
        try {
            const stats = await fs.stat(filePath);
            return { size: stats.size };
        } catch {
            return null;
        }
    }
}

export async function readVideoFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
}

export async function deleteVideo(videoId: string): Promise<void> {
    const key = `videos/${videoId}.webm`;

    if (isCloudStorage && s3Client) {
        try {
            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                })
            );
        } catch (error) {
            console.warn(`Could not delete video from R2 ${videoId}:`, error);
        }
    } else {
        const filePath = getVideoAbsolutePath(videoId);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.warn(`Could not delete local video ${videoId}:`, error);
        }
    }
}
