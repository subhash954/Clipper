# CLIPPER — PHASE 3 FORENSIC AUDIT REPORT
## Real Project + Database Architecture Audit

**Repository:** `subhash954/Clipper`  
**Date:** 2026-10-02  
**Auditor:** Clipper Master Infrastructure Engine  
**Objective:** Forensic examination of project persistence, database schema, RLS, API authorization, localStorage dependencies, React-only state, ownership integrity, and concurrency control.

---

## 1. Current Project Model & Schema Audit

### 1.1 Existing Database Tables (`supabase/schema.sql`, `supabase/migrations/**`)
1. **`projects`**:
   - Primary key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign keys: `user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL`, `workspace_id UUID REFERENCES public.workspaces(id)`
   - Columns: `source_external_id`, `title`, `channel_name`, `thumbnail_url`, `workflow_type`, `source_url`, `source_type`, `duration_seconds`, `status`, `error_message`, `cost_usd`, `created_at`, `updated_at`.
   - **Missing Fields**:
     - `active_media_id UUID REFERENCES public.media_assets(id)` (No canonical pointer to master media asset)
     - `active_version_id UUID` (No canonical pointer to active timeline/EDL version)
     - `version INTEGER DEFAULT 1` (No optimistic concurrency control revision counter)
     - `description TEXT` (No user-facing project description)
     - `deleted_at TIMESTAMP WITH TIME ZONE` (No soft-delete column; deletion is hard or uncoordinated)
2. **`media_assets` (Phase 2 Canonical)**:
   - Upgraded in Phase 2 with `storage_provider`, `storage_key`, `checksum`, `etag`, `status`, `upload_session_id`, `processing_status`.
   - References `project_id UUID REFERENCES public.projects(id)` and `user_id UUID NOT NULL`.
   - Well-structured, but projects do not point back to their active media asset.
3. **`transcripts`**:
   - References `project_id UUID UNIQUE NOT NULL`, stores `transcript_text`, `words JSONB`, `utterances JSONB`, `language`, `source`.
   - Missing `media_asset_id` reference to associate transcripts directly with specific source media files.
4. **`clips`**:
   - References `project_id UUID NOT NULL`.
   - Missing `source_media_id UUID REFERENCES public.media_assets(id)`.
5. **`timeline_versions` / `project_versions`**:
   - Created in `supabase/schema.sql` and `20261002_mission_4_studio_editor.sql`.
   - Stores `render_spec JSONB`, `version_number INTEGER`, `name TEXT`, `description TEXT`.
   - Defect: `VersionService` generates string IDs (`ver-${projectId}-${versionNumber}-${Date.now()}`) instead of UUIDs, causing Supabase insert failures and silently falling back to local file writes (`data/timeline_versions/${projectId}.json`).
6. **`render_jobs`**:
   - References `project_id`, `clip_id`, `user_id`.
   - Missing `version_id`, `input_media_id`, `output_media_id`.

---

## 2. API Authorization & Ownership Audit

1. **`app/api/projects/route.ts`**:
   - `GET`: If `?id=` is supplied, it verifies access via `requireProjectAccess(user, id, 'viewer')`.
   - **Critical Defect**: If `?id=` is not supplied, it calls `storage.listProjects()` which fetches ALL projects across all users, and then filters in Node.js memory (`allProjects.filter(p => p.userId === user.id)`). This violates multi-tenant database isolation.
   - `POST`: Used for both project creation and project update. Does not validate state transitions or enforce version numbers.
   - `DELETE`: Verifies ownership via `requireProjectAccess(user, id, 'owner')` and purges storage prefix before deleting project row.
2. **Missing Canonical Endpoints**:
   - No `app/api/projects/[id]/route.ts` (RESTful `GET`, `PATCH`, `DELETE`).
   - No `app/api/projects/[id]/duplicate/route.ts` (Project duplication is done entirely on the frontend by synthesizing a new payload in React and calling `POST /api/projects`).
3. **`lib/auth/serverAuth.ts`**:
   - `getAuthenticatedUser(req)` extracts user token or returns `DEV_USER_ID` in development.
   - `requireProjectAccess(user, projectId, minRole)` properly verifies `project.userId === user.id` (or admin).
   - In `20261002_mission_4_studio_editor.sql`, RLS policies on `timeline_versions` included `OR auth.uid() IS NULL`, which is an insecure bypass loophole.

---

## 3. LocalStorage & React-Only State Dependencies

1. **`app/studio/page.tsx`**:
   - Line 81-87: If `projectId` is missing from the URL, it generates a fallback client-side ID: `proj-${Date.now()}`.
   - Line 207: Checks `localStorage.getItem('clipper_last_project_id')`.
   - Line 246: Hardcodes `status: 'completed'` on every save payload.
   - Line 280-287: Debounced auto-save directly overwrites project state without sending an expected version number.
   - Line 290-298: Contains demo mode loader setting `DEMO_VIDEO_URL`.
2. **`components/CreateProjectModal.tsx`**:
   - Line 63-147: Uploads media first before creating a database project. If the media upload succeeds but project creation fails, an orphaned media asset remains.
   - Correct flow must create the project row first, then upload media attached to that project ID.
3. **`app/dashboard/page.tsx`**:
   - Line 67-91: `handleDuplicateProject` clones the project in browser React memory, generates `crypto.randomUUID()` on the client, and `POST`s the entire duplicated object back to `/api/projects`.

---

## 4. Edit Decision List (EDL) & Versioning Audit

1. **EDL Persistence**:
   - `CanonicalRenderSpec` exists in `lib/editor/types.ts` and captures tracks, cuts, captions, reframe, audio mix, and overlays.
   - However, Studio does not load the EDL from `timeline_versions` on project open. It reconstructs words and cuts from `project.clips` and `project.transcript`.
   - Full timeline editing state (tracks, overlays, custom volume) is not persisted if the user refreshes without saving a named version.
2. **Optimistic Concurrency Control (OCC)**:
   - There is currently **zero revision/version checking** on project updates.
   - Two users or two tabs editing the same project will silently overwrite each other's changes (`Last-Write-Wins`).

---

## 5. Summary of Required Modifications

| Component | Target File | Action Required |
| :--- | :--- | :--- |
| **Database Migration** | `supabase/migrations/20261002_phase_3_project_architecture.sql` | Add `active_media_id`, `active_version_id`, `version`, `deleted_at`, strict RLS, indexes |
| **Domain Types** | `lib/types.ts` | Update `Project` with mandatory `userId`, `version`, `activeMediaId`, `activeVersionId`, lifecycle status |
| **Storage Adapter** | `lib/storage/index.ts` | Update `SupabaseStorageAdapter` and `IStorageAdapter` with user-scoped `listProjects(userId)`, OCC `saveProject`, server-side `duplicateProject` |
| **Project Detail API** | `app/api/projects/[id]/route.ts` | Implement canonical REST `GET`, `PATCH` (with OCC conflict 409 check), `DELETE` |
| **Project Duplication API** | `app/api/projects/[id]/duplicate/route.ts` | Implement server-side transactional duplication |
| **Project List API** | `app/api/projects/route.ts` | Refactor `GET` to query database `WHERE user_id = user.id AND deleted_at IS NULL` |
| **Version Service** | `lib/editor/versionService.ts` | Fix UUID generation for `timeline_versions`, eliminate local file fallback in production |
| **Create Project Modal** | `components/CreateProjectModal.tsx` | Create DB project first, attach media, stream upload, navigate with valid `projectId` |
| **Studio Page** | `app/studio/page.tsx` | Eliminate `proj-${Date.now()}` and `localStorage`, load strictly from DB, send `expectedVersion` on save |
| **Dashboard Page** | `app/dashboard/page.tsx` | Use server-side `/api/projects/${id}/duplicate` endpoint |
| **Error Taxonomy** | `lib/errors.ts` | Add `PROJECT_VERSION_CONFLICT`, `INVALID_PROJECT_STATE`, `PROJECT_NOT_OWNED` |
| **Test Suite** | `tests/phase3_project_database.test.ts` | 25+ comprehensive automated tests verifying security, isolation, OCC, and lifecycle |

---

*Forensic Audit Complete. Proceeding to Phase 3 Implementation.*
