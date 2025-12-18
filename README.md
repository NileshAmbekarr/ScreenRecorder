# 🎬 Screen Recorder

A modern, full-stack screen recording application built with Next.js 16. Record your screen, trim videos, and share them instantly with a public link.

## ✨ Features

- **Screen Recording** - Capture screen with optional microphone audio
- **Video Trimming** - Trim start/end with draggable timeline UI
- **Cloud Storage** - Cloudflare R2 for scalable video hosting
- **Cloud Database** - Turso (LibSQL) for serverless SQLite
- **Analytics** - View counts and watch percentage tracking
- **Shareable Links** - Public watch pages for each video

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- FFmpeg installed and in PATH
- (Optional) Turso account for cloud database
- (Optional) Cloudflare R2 account for cloud storage

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd screen-recorder

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

```env
# Database (Turso - optional, uses local SQLite if not set)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Storage (R2 - optional, uses local filesystem if not set)
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=screen-recorder-uploads
S3_PUBLIC_URL=https://pub-xxxx.r2.dev

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=200
FFMPEG_PATH=ffmpeg
```

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | Next.js 16 (App Router) | Modern React with server components |
| **Database** | Drizzle ORM + Turso | Type-safe SQL, serverless-compatible |
| **Storage** | Cloudflare R2 | S3-compatible, zero egress fees |
| **Video Processing** | FFmpeg (server-side) | Industry standard, fast copy-mode trimming |
| **Recording** | MediaRecorder API | Native browser API, no dependencies |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│  1. MediaRecorder captures screen → WebM blob                   │
│  2. User trims video with timeline UI                           │
│  3. Blob + trim times sent to server                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Next.js API)                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Save raw video to temp file                                 │
│  2. FFmpeg trims video (copy mode = fast, no re-encoding)       │
│  3. Upload trimmed video to R2                                  │
│  4. Delete temp files                                           │
│  5. Save metadata to Turso database                             │
│  6. Return public watch page URL                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WATCH PAGE                                 │
├─────────────────────────────────────────────────────────────────┤
│  • Video streams directly from R2 (zero server bandwidth)       │
│  • View tracking with 24-hour deduplication                     │
│  • Watch progress analytics                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Server-side FFmpeg** - More reliable than WebAssembly, handles large files
2. **Copy-mode trimming** - Instant trims without re-encoding (slight accuracy tradeoff)
3. **R2 for storage** - S3-compatible API, no egress fees = huge cost savings
4. **Turso for database** - SQLite simplicity with cloud scalability
5. **No authentication** - MVP simplicity, videos are public by design

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── uploads/[...path]/   # Serve local videos (dev only)
│   │   └── videos/
│   │       ├── upload-raw/      # Upload & process videos
│   │       └── [videoId]/       # Video metadata & analytics
│   ├── v/[videoId]/             # Public watch page
│   └── page.tsx                 # Home page (recorder)
├── components/
│   ├── RecorderPanel.tsx        # Screen capture UI
│   ├── BlobPreview.tsx          # Video preview & download
│   ├── Trimmer.tsx              # Timeline trimming UI
│   ├── Uploader.tsx             # Upload progress UI
│   └── PublicPlayer.tsx         # Watch page player
└── lib/
    ├── db.ts                    # Drizzle + Turso connection
    ├── schema.ts                # Database schema
    ├── storage.ts               # R2/local storage abstraction
    └── ffmpeg.ts                # FFmpeg wrapper
```

---

## ⚠️ Production Readiness

### Current Status: **MVP Ready** ✅

This app is suitable for:
- Personal use
- Small teams
- Demos and prototypes
- Learning/educational purposes

### What's Production Ready

| Feature | Status | Notes |
|---------|--------|-------|
| Core recording flow | ✅ | Stable in Chrome/Edge |
| Video trimming | ✅ | Fast copy-mode |
| Cloud storage (R2) | ✅ | Scalable, cost-effective |
| Cloud database (Turso) | ✅ | Serverless, edge-compatible |
| View analytics | ✅ | With deduplication |
| Error handling | ✅ | Graceful failures |

### What Needs Improvement for Enterprise Production

| Area | Current State | Recommended Improvement |
|------|---------------|------------------------|
| **Authentication** | None | Add NextAuth.js or Clerk for user accounts |
| **Authorization** | Public videos | Add private videos, sharing permissions |
| **Rate Limiting** | None | Add rate limiting to prevent abuse |
| **Video Validation** | Basic MIME check | Add virus scanning, content moderation |
| **Monitoring** | Console logs | Add Sentry, LogRocket, or similar |
| **CDN** | R2 only | Add Cloudflare CDN for faster delivery |
| **Thumbnails** | None | Generate video thumbnails with FFmpeg |
| **Browser Support** | Chrome/Edge | Add Firefox/Safari recording support |
| **Video Formats** | WebM only | Add MP4 conversion option |
| **Storage Cleanup** | Manual | Add scheduled cleanup for old videos |
| **Backup** | None | Add database backup strategy |

### Recommended Production Checklist

```bash
# Before deploying to production:
[ ] Set strong S3_SECRET_ACCESS_KEY
[ ] Configure NEXT_PUBLIC_BASE_URL to production domain
[ ] Set up Cloudflare CDN in front of R2
[ ] Enable Turso database backups
[ ] Add error monitoring (Sentry)
[ ] Add rate limiting middleware
[ ] Test with multiple concurrent uploads
[ ] Set appropriate MAX_UPLOAD_MB limit
[ ] Configure CORS if needed
```

---

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Note: FFmpeg is not available on Vercel's serverless functions. For production, consider:
1. Using a separate video processing service (AWS Lambda + FFmpeg layer)
2. Running on a VPS with FFmpeg installed
3. Using a managed service like Mux or Cloudflare Stream

### Docker

```dockerfile
FROM node:18-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📄 License

MIT

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR.
