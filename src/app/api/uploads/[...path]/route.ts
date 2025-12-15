import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        const filePath = path.join(UPLOAD_DIR, ...pathSegments);

        // Security: Ensure the path is within UPLOAD_DIR
        const resolvedPath = path.resolve(filePath);
        const resolvedUploadDir = path.resolve(UPLOAD_DIR);

        if (!resolvedPath.startsWith(resolvedUploadDir)) {
            return NextResponse.json(
                { error: 'forbidden', message: 'Access denied' },
                { status: 403 }
            );
        }

        // Check if file exists
        try {
            await fs.access(resolvedPath);
        } catch {
            return NextResponse.json(
                { error: 'not_found', message: 'File not found' },
                { status: 404 }
            );
        }

        // Get file stats
        const stats = await fs.stat(resolvedPath);
        const fileBuffer = await fs.readFile(resolvedPath);

        // Determine content type based on extension
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentTypeMap: Record<string, string> = {
            '.webm': 'video/webm',
            '.mp4': 'video/mp4',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        // Support range requests for video streaming
        const rangeHeader = request.headers.get('range');

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunkSize = end - start + 1;
            const chunk = fileBuffer.subarray(start, end + 1);

            return new NextResponse(chunk, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize.toString(),
                    'Content-Type': contentType,
                },
            });
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': stats.size.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('File serve error:', error);
        return NextResponse.json(
            { error: 'server_error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
