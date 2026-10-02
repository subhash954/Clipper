# CLIPPER MEDIA STORAGE INFRASTRUCTURE
## Production Cloud Storage Architecture: Bunny Storage + Bunny CDN

---

## 1. Executive Summary

Clipper's Phase 2 Media Storage Infrastructure eliminates all reliance on local filesystem storage (`public/uploads`, `public/exports`), ephemeral server disks, and database binary blobs in production environments. Media assets are ingested via streaming direct uploads into **Bunny Storage** and delivered globally via **Bunny CDN** with cryptographically signed token URLs.

```
Browser / Client
      │
      ▼  (POST /api/media/upload/init)
Clipper Authorization & Session Engine
      │
      ▼  (Chunked stream / direct upload)
Bunny Storage REST API
      │
      ▼  (POST /api/media/upload/complete)
FFprobe Media Validation & Probing
      │
      ▼  (FFmpeg Proxy + Thumbnail Generator)
Bunny Storage Artifact Vault
      │
      ▼  (SHA-256 Token Signed Delivery)
Bunny CDN Global Edge Cache
      │
      ▼
End User Playback / Studio Scrubbing
```

---

## 2. Core Architectural Principles

1. **Provider-Agnostic Storage Layer (`IStorageService`, `IStorageProvider`)**:
   All media operations interact exclusively through `StorageService`. Concrete providers (`BunnyStorageProvider`, `LocalStorageProvider` for dev/unit tests) are interchangeable without changing application business logic.
2. **Zero Persistent Disk Writes in Production**:
   Multi-gigabyte video files are never written to Next.js server disk or buffered completely in RAM. All video manipulation operates through streams or isolated ephemeral scratch directories (`data/temp_*`) that are deterministically purged in `finally` blocks.
3. **Immutable Source Media**:
   The uploaded master original file is write-once, read-only. Transformations (720p editing proxies, thumbnails, audio extractions, renders) are saved under distinct artifact paths and never overwrite source files.
4. **Strict Multi-Tenant Path Isolation**:
   Media storage paths are canonically namespaced by authenticated user and project IDs. Storage key generation enforces path traversal checks (`..`, leading slashes, path delimiters) and sanitizes file names.
5. **No Synthetic / Fake Fallbacks**:
   If media is missing, corrupted, or probe validation fails, Clipper fails closed with structured `ClipperError` codes (`MEDIA_UNAVAILABLE`, `MEDIA_INVALID`) and HTTP 400/404 statuses.

---

## 3. Canonical Storage Key Taxonomy

Every object in cloud storage adheres strictly to the deterministic taxonomy:

```
users/{userId}/projects/{projectId}/media/{mediaId}/{artifactType}/{sanitizedFileName}
```

### Artifact Types:
| Artifact Type | Description | Example Path |
| :--- | :--- | :--- |
| `source` | Master original video uploaded by creator | `.../media/{id}/source/original.mp4` |
| `proxy` | 720p H.264 fast-scrubbing editor proxy | `.../media/{id}/proxy/proxy-720p.mp4` |
| `thumbnails` | Extracted high-res frame capture | `.../media/{id}/thumbnails/thumbnail.jpg` |
| `audio` | 16kHz mono MP3 extracted for STT | `.../media/{id}/audio/extracted_16k.mp3` |
| `renders` | Final exported vertical clips | `.../media/{id}/renders/{jobId}.mp4` |
| `captions` | Generated ASS / SRT subtitle timelines | `.../media/{id}/captions/subtitles.ass` |
| `analysis` | Vision/audio scene telemetry caches | `.../media/{id}/analysis/scene_data.json` |

---

## 4. Ingestion & Upload Flows

### Flow A: Direct Chunked Resumable Upload (Large Media > 5MB)
1. **Initialize (`POST /api/media/upload/init`)**:
   - Authenticates user session and validates project ownership.
   - Validates MIME type and file extension (MP4, QuickTime MOV, WebM).
   - Generates a UUID `mediaId` and `sessionId`.
   - Records `media_assets` row in Supabase with status `INITIATED`.
   - Returns upload session configuration and part sizing.
2. **Stream Chunks (`PUT /api/media/upload/chunk?sessionId=...&partNumber=...`)**:
   - Accepts chunk payload without buffering other chunks in memory.
   - Generates an MD5 ETag receipt per chunk.
   - Forwards chunk parts directly to storage.
3. **Complete & Probe (`POST /api/media/upload/complete`)**:
   - Assembles completed chunks into master storage object.
   - Validates magic bytes signature (`ftyp`, `moov`, `matroska`).
   - Runs deep FFprobe inspection (resolution, codec, duration, audio streams).
   - Generates 720p editing proxy and thumbnail via FFmpeg.
   - Stores proxy and thumbnail into Bunny Storage under canonical keys.
   - Updates `media_assets` status to `READY`.

### Flow B: Ephemeral Single-Part Upload (< 5MB)
- `POST /api/media/upload` accepts standard `multipart/form-data`.
- Validates magic bytes, probes with FFprobe, generates proxy/thumbnail, and uploads to Bunny Storage immediately with cleanup of temp scratch.

---

## 5. Bunny CDN Token Authentication

Direct public access to storage zones is blocked. Media delivery is authorized via Bunny CDN URL token authentication:

```typescript
const hashable = `${cdnTokenKey}${cleanPath}${expires}${userIp}`;
const token = crypto
  .createHash('sha256')
  .update(hashable)
  .digest('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

const deliveryUrl = `https://${cdnHostname}${cleanPath}?token=${token}&expires=${expires}`;
```

- **Expiration**: Signed URLs expire after a configurable duration (default: 3600s, configurable up to 86400s).
- **IP Binding**: Optional user IP binding to prevent URL sharing.
- **Content Disposition**: Custom `download=filename.mp4` parameters supported.

---

## 6. Cascade Deletion & Purging

When a user deletes a media asset or an entire project:
1. Ownership is verified against authenticated session in Supabase.
2. The database record is transitioned to `DELETING`.
3. `StorageService.deletePrefix("users/{userId}/projects/{projectId}/media/{mediaId}/")` purges all related source files, proxies, thumbnails, and renders from Bunny Storage.
4. Database records in `media_assets` and `clips` are deleted.

---

## 7. Environment Configuration

```bash
# Storage Provider Selection ('bunny' for production, 'local' for unit tests)
STORAGE_PROVIDER=bunny

# Bunny Storage REST Credentials
BUNNY_STORAGE_ZONE=your_storage_zone_name
BUNNY_STORAGE_API_KEY=your_bunny_storage_api_key
BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com

# Bunny CDN Delivery
BUNNY_CDN_HOSTNAME=your-zone.b-cdn.net
BUNNY_CDN_TOKEN_KEY=your_cdn_token_authentication_key

# Production Safeguards
ALLOW_DEV_LOCAL_STORAGE=false
```
