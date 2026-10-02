# CLIPPER PHASE 2: FORENSIC AUDIT — MEDIA UPLOAD & STORAGE INFRASTRUCTURE

**Audit Date:** October 2, 2026  
**Auditor:** Clipper Master Engineering Agent  
**Repository:** https://github.com/subhash954/Clipper (`main`)  
**Mission:** Transition from local filesystem disk writes to real production-grade Bunny Storage + Bunny CDN with a provider-agnostic `StorageService`.

---

## 1. Executive Summary

A comprehensive forensic audit of media upload, storage, processing, and delivery was conducted across `app/`, `lib/`, `components/`, `supabase/`, and test suites.

While Phase 1 succeeded in eliminating synthetic fallback boxes, hardening error codes, and enforcing tenant authorization, **media storage is currently coupled to the local Next.js server filesystem**:
1. `app/api/media/upload/route.ts` streams entire multi-MB/GB files through Next.js memory into `public/uploads/{assetId}.mp4` on local disk.
2. `lib/renderEngine.ts` writes rendered videos to `public/exports/{jobId}.mp4` on local disk and returns relative URLs `/exports/{jobId}.mp4`.
3. `lib/storage/index.ts` contains `LocalMediaStorageAdapter`, which treats `public/exports` as the authoritative media store.
4. `CreateProjectModal.tsx` uploads directly to `/api/media/upload`, storing files on the server container disk rather than cloud storage.
5. `public.media_assets` in `supabase/schema.sql` lacks columns for cloud storage provider, bucket/zone, storage key, checksum, ETag, and fine-grained processing state machine statuses.
6. Deleting projects does not clean up associated media files from object storage.

---

## 2. Forensic Findings by System Component

### 2.1 Current Upload Flow
- **File:** `app/api/media/upload/route.ts`
- **Current Behavior:** 
  - Receives `multipart/form-data` with `file`.
  - Converts file to memory Buffer: `Buffer.from(await file.arrayBuffer())`.
  - Writes directly to disk: `fs.writeFileSync(destinationPath, buffer)` inside `public/uploads`.
  - Performs magic bytes validation and `ffprobe` inspection on local file.
  - Returns `/uploads/{diskFileName}`.
- **Production Vulnerability:** 
  - In serverless, Docker containers, or multi-instance VPS, writing to `public/uploads` causes immediate out-of-memory errors on large videos (>500MB) and data loss on pod restart.
  - No upload session tracking or resumability.
  - No project authorization check on upload initiation.

### 2.2 Current Storage Architecture
- **File:** `lib/storage/index.ts`
- **Current Behavior:**
  - `MediaStorageAdapter` interface defines basic `upload`, `download`, `getSignedUrl`, `delete`, `exists`.
  - Only implementation is `LocalMediaStorageAdapter`, which writes files to `public/exports` with relative URLs.
  - No Bunny Storage, S3, R2, or remote provider implementation exists.

### 2.3 Current Database Media Model
- **File:** `supabase/schema.sql` (Lines 47–68)
- **Current Table:** `public.media_assets`
  - Columns: `id`, `project_id`, `user_id`, `file_name`, `file_url`, `storage_path`, `mime_type`, `size_bytes`, `duration`, `width`, `height`, `codec`, `audio_codec`, `fps`, `sample_rate`, `channels`, `bitrate`, `rotation`, `color_space`, `created_at`.
- **Missing Production Columns:**
  - `storage_provider` ('bunny' | 's3' | 'local')
  - `storage_bucket_or_zone`
  - `storage_key` (canonical hierarchical path: `users/{userId}/projects/{projectId}/media/{mediaId}/source/original.mp4`)
  - `original_filename` & `sanitized_filename`
  - `checksum` (SHA-256) & `etag`
  - `status` (state machine: `INITIATED`, `UPLOADING`, `UPLOADED`, `VALIDATING`, `PROBING`, `READY_FOR_PROCESSING`, `PROCESSING`, `READY`, `FAILED`, `DELETING`, `DELETED`)
  - `upload_session_id`
  - `processing_status`
  - `updated_at`

### 2.4 Current Render Input & Output Behavior
- **File:** `lib/renderEngine.ts`
- **Current Behavior:**
  - Slices video into `data/temp_renders/{jobId}`.
  - Saves final MP4 directly into `public/exports/{jobId}.mp4`.
  - Sets `outputUrl: /exports/{jobId}.mp4`.
- **Production Flaw:**
  - Rendered videos are saved on ephemeral application container disk instead of being uploaded to Bunny Storage and delivered via Bunny CDN signed URLs.

### 2.5 Demo & Sample Media Contaminations
- **Files:** `lib/sampleData.ts`, `components/VideoUploader.tsx`, `app/studio/page.tsx`
- **Occurrences:**
  - `lib/sampleData.ts`: Defines `DEMO_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"` and `SAMPLE_VIDEO_URL`.
  - `components/VideoUploader.tsx`: Contains "Try With Instant Sample Video" which triggers `onVideoSelected(SAMPLE_VIDEO_URL, ...)`.
  - `app/studio/page.tsx`: Contains `handleLoadDemo()` button for explicit sample demonstration.
- **Audit Assessment:**
  - While explicit demo button in development is acceptable if segregated, production project creation must never silently substitute demo video when upload fails.

### 2.6 Project Deletion Leakage
- **File:** `app/api/projects/route.ts` & `lib/storage/index.ts`
- **Current Behavior:**
  - `storage.deleteProject(id)` deletes the project row and cascades in Postgres, but leaves all associated video files on filesystem or remote storage.
- **Production Flaw:**
  - Media assets and renders become orphaned storage objects incurring permanent storage costs.

---

## 3. Files Requiring Modification / Creation

| Component | Target File | Action | Purpose |
|---|---|---|---|
| **Storage Abstraction** | `lib/storage/types.ts` | **CREATE** | Define `StorageService` interface, `UploadSession`, `StorageObjectMetadata`, `SignedUrlOptions`, `MultipartUpload`. |
| **Storage Service** | `lib/storage/storageService.ts` | **CREATE** | Master provider-agnostic storage service coordinating providers. |
| **Bunny Provider** | `lib/storage/providers/bunnyStorageProvider.ts` | **CREATE** | Official Bunny Storage REST API + Bunny CDN Token Authentication implementation. |
| **S3/R2 Provider** | `lib/storage/providers/s3StorageProvider.ts` | **CREATE** | S3-compatible provider for AWS S3, Cloudflare R2, Backblaze B2, Bunny S3. |
| **Local Provider** | `lib/storage/providers/localStorageProvider.ts` | **CREATE** | Provider for isolated development and unit tests (strictly forbidden in production). |
| **Direct Upload API** | `app/api/media/upload/init/route.ts` | **CREATE** | Initialize upload session with server authorization and signed upload session data. |
| **Upload Chunk API** | `app/api/media/upload/chunk/route.ts` | **CREATE** | Direct streaming chunk ingestion to Bunny without buffering on server disk. |
| **Upload Complete API** | `app/api/media/upload/complete/route.ts` | **CREATE** | Verify Bunny object, execute probe, generate thumbnail & proxy, transition to `READY`. |
| **Legacy Upload Route** | `app/api/media/upload/route.ts` | **REFACTOR** | Replace local disk write with `StorageService` upload and full probe pipeline. |
| **Media Probe & Proxy** | `lib/media/processingService.ts` | **CREATE** | Pipeline for generating real FFmpeg editing proxies and thumbnails directly to storage. |
| **Database Migration** | `supabase/migrations/20261002_phase_2_media_assets.sql` | **CREATE** | Alter/upgrade `media_assets` table with Bunny storage keys, sessions, and state machine. |
| **Database Models** | `lib/types.ts` | **UPDATE** | Update `MediaAsset` and `ProjectMedia` with state machine and storage metadata. |
| **Render Engine** | `lib/renderEngine.ts` | **UPDATE** | Download source from storage to temp scratch, render, upload output to Bunny Storage, clean temp scratch. |
| **Project Deletion** | `app/api/projects/route.ts` | **UPDATE** | On project delete, query all media assets and purge prefix from storage provider. |
| **Media Deletion** | `app/api/media/[id]/route.ts` | **CREATE** | Securely delete single media asset and its derived thumbnails, proxy, and audio from storage. |
| **CreateProjectModal** | `components/CreateProjectModal.tsx` | **UPDATE** | Use chunked / direct upload pipeline with honest progress and error reporting. |
| **Environment Config** | `.env.example`, `lib/config/envValidator.ts` | **UPDATE** | Add and validate `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_HOSTNAME`, `BUNNY_CDN_HOSTNAME`, `BUNNY_CDN_TOKEN_KEY`. |
| **Tests** | `tests/phase2_media_storage.test.ts` | **CREATE** | Comprehensive 25-point acceptance test suite including real media probing, proxy, and upload verification. |
| **Architecture Doc** | `MEDIA_STORAGE_ARCHITECTURE.md` | **CREATE** | Permanent system documentation. |

---

## 4. Risks & Mitigations

1. **Risk: Bunny Credentials Not Injected Locally During Testing**
   - *Mitigation:* Ensure `StorageService` operates in test mode with `LocalStorageProvider` for unit tests and local dev, but strictly requires verified Bunny credentials when `STORAGE_PROVIDER=bunny` or `NODE_ENV=production`.
2. **Risk: Network Interruption During Large File Uploads**
   - *Mitigation:* Implement chunked session upload with part tracking, resumability, and final size + checksum verification at `/complete`.
3. **Risk: Inadvertent Leaking of Master Bunny Storage API Key to Browser**
   - *Mitigation:* The master storage key never leaves the server. Direct browser uploads use short-lived signed tokens or streaming edge proxy pipes that forward raw bytes without writing to disk.
4. **Risk: Path Traversal via Filename Manipulation**
   - *Mitigation:* Enforce server-generated canonical storage keys: `users/{userId}/projects/{projectId}/media/{mediaId}/source/original.{ext}`. User-provided filenames are only stored as sanitized metadata labels.

---

**Next Step:** Proceed to Part 2 & Part 3: Implement `StorageService` interface and `BunnyStorageProvider`.
