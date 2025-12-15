import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { saveRawVideo, getFinalVideoPath, getPublicUrl, deleteRawVideo, ensureUploadDirs } from '@/lib/storage';
import { trimVideo, getVideoDuration, copyVideo } from '@/lib/ffmpeg';
import fs from 'fs/promises';

// Configure this route to handle large files
export const config = {
    api: {
        bodyParser: false,
    },
};

// Increase timeout for file uploads
export const maxDuration = 60;

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '200', 10);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
    console.log('Upload request received');

    try {
        // Ensure upload directories exist first
        await ensureUploadDirs();
        console.log('Upload directories ensured');

        const formData = await request.formData();
        console.log('FormData parsed');

        const file = formData.get('file') as File | null;
        const startTimeStr = formData.get('startTime') as string | null;
        const endTimeStr = formData.get('endTime') as string | null;

        console.log('File:', file ? `${file.name}, ${file.size} bytes, ${file.type}` : 'null');
        console.log('Start time:', startTimeStr, 'End time:', endTimeStr);

        if (!file) {
            return NextResponse.json(
                { error: 'missing_file', message: 'No file provided' },
                { status: 400 }
            );
        }

        // Check file size
        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json(
                { error: 'file_too_large', message: `Upload failed: File exceeds maximum allowed size (${MAX_UPLOAD_MB}MB).` },
                { status: 413 }
            );
        }

        // Validate file type - be more lenient
        const isVideo = file.type.startsWith('video/') || file.name.endsWith('.webm');
        if (!isVideo) {
            return NextResponse.json(
                { error: 'invalid_type', message: `Only video files are allowed. Got: ${file.type}` },
                { status: 400 }
            );
        }

        const videoId = uuidv4();
        console.log('Generated videoId:', videoId);

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log('Buffer created, size:', buffer.length);

        // Save raw video
        const rawPath = await saveRawVideo(videoId, buffer);
        console.log('Raw video saved to:', rawPath);

        const finalPath = getFinalVideoPath(videoId);
        console.log('Final path will be:', finalPath);

        // Parse trim times
        const startTime = startTimeStr ? parseFloat(startTimeStr) : 0;
        const endTime = endTimeStr ? parseFloat(endTimeStr) : null;

        let result;
        if (endTime !== null && startTime >= 0 && endTime > startTime) {
            // Trim the video
            console.log(`Trimming video from ${startTime}s to ${endTime}s`);
            result = await trimVideo(rawPath, finalPath, startTime, endTime);
        } else {
            // Just copy the video (no trimming)
            console.log('Copying video without trimming');
            result = await copyVideo(rawPath, finalPath);
        }

        console.log('FFmpeg result:', result);

        if (!result.success) {
            console.error('FFmpeg failed:', result.error);
            await deleteRawVideo(videoId);
            return NextResponse.json(
                { error: 'processing_failed', message: result.error || 'Video processing failed' },
                { status: 500 }
            );
        }

        // Check if final file exists
        try {
            await fs.access(finalPath);
            console.log('Final file exists');
        } catch {
            console.error('Final file does not exist at:', finalPath);
            await deleteRawVideo(videoId);
            return NextResponse.json(
                { error: 'processing_failed', message: 'Final video file was not created' },
                { status: 500 }
            );
        }

        // Get duration of final video
        const duration = await getVideoDuration(finalPath);
        console.log('Video duration:', duration);

        if (duration === null) {
            console.error('Could not determine duration');
            // Don't fail, use estimated duration
            const estimatedDuration = endTime && startTime ? (endTime - startTime) : 10;
            console.log('Using estimated duration:', estimatedDuration);
        }

        // Get file size of final video
        const stats = await fs.stat(finalPath);
        console.log('Final file size:', stats.size);

        // Create database record
        const video = await prisma.video.create({
            data: {
                id: videoId,
                filename: `videos/${videoId}.webm`,
                contentType: 'video/webm',
                durationSeconds: duration || (endTime && startTime ? endTime - startTime : 10),
                sizeBytes: stats.size,
                publicUrl: getPublicUrl(videoId),
            },
        });
        console.log('Database record created:', video.id);

        // Clean up raw file
        await deleteRawVideo(videoId);
        console.log('Raw file cleaned up');

        const response = {
            videoId: video.id,
            publicUrl: video.publicUrl,
            duration: video.durationSeconds,
            sizeBytes: video.sizeBytes,
            watchPageUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/v/${video.id}`,
        };

        console.log('Sending response:', response);

        return NextResponse.json(response, { status: 201 });
    } catch (error) {
        console.error('Upload error:', error);

        // Return proper JSON error
        return NextResponse.json(
            {
                error: 'server_error',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                details: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
