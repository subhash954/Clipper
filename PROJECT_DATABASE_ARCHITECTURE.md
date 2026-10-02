# Clipper Project & Database Architecture
## Phase 3 Engineering Specification & Schema Truth

This document specifies the canonical, database-authoritative entity model, security controls, state machine transitions, and concurrency mechanics for the Clipper video content operating system.

---

## 1. Canonical Entity Hierarchy

```
Profiles (Users / Tenancy)
  └── Projects (Workspace Project Entity, OCC Versioning)
        ├── Media Assets (Immutable Raw Ingestion & Probing)
        │     ├── Proxy Media (720p Scrubbing Stream)
        │     └── Thumbnail (Poster Frame)
        ├── Transcripts (Deepgram Nova-2 Word & Utterance Timestamps)
        ├── Clips (AI Editorial Candidates & Aligned Segments)
        ├── Timeline Versions (EDL Revisions, Multi-track Canvas Specs)
        └── Render Jobs (Native FFmpeg Jobs Backed by Storage)
              └── Render Assets (Exported MP4s & Deliverables)
```

### Core Tenet
> **Database-Authoritative Truth:** Frontend state (React hooks, component state) and browser storage (`localStorage`, `sessionStorage`, `IndexedDB`) are **never** authoritative. All entities, versions, and transitions originate and persist within the PostgreSQL relational store.

---

## 2. Relational Schema Specification

### 2.1 Table: `projects`
Tracks the master lifecycle of video processing and timeline editing.

| Column | Type | Constraints / Defaults | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | RFC 4122 compliant unique identifier |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | Strict tenant ownership |
| `workspace_id` | `UUID` | `NULL` | Organization / Agency workspace scope |
| `title` | `TEXT` | `NOT NULL DEFAULT 'Untitled Project'` | Project display name |
| `description` | `TEXT` | `NULL` | Optional project metadata description |
| `version` | `INT` | `NOT NULL DEFAULT 1` | Optimistic Concurrency Control (OCC) revision counter |
| `active_media_id` | `UUID` | `NULL REFERENCES media_assets(id) ON DELETE SET NULL` | Pointer to primary source media asset |
| `active_version_id` | `UUID` | `NULL REFERENCES timeline_versions(id) ON DELETE SET NULL` | Pointer to current active timeline version |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | Canonical lifecycle status (see State Machine) |
| `source_type` | `TEXT` | `NOT NULL DEFAULT 'upload'` | Source ingestion origin (`upload`, `youtube`, `script`) |
| `source_url` | `TEXT` | `NULL` | Raw source media URL or storage key |
| `source_external_id`| `TEXT` | `NULL` | YouTube Video ID, TikTok ID, or external file ID |
| `channel_name` | `TEXT` | `NULL` | Creator channel or brand label |
| `thumbnail_url` | `TEXT` | `NULL` | Project preview poster |
| `workflow_type` | `TEXT` | `NOT NULL DEFAULT 'youtube_to_shorts'` | Selected transformation pipeline |
| `duration_seconds` | `NUMERIC(10,2)`| `NOT NULL DEFAULT 0.00` | Total video duration |
| `cost_usd` | `NUMERIC(10,4)`| `NOT NULL DEFAULT 0.0000` | Aggregate cost tracking |
| `error_message` | `TEXT` | `NULL` | Error details on failure states |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |
| `deleted_at` | `TIMESTAMPTZ` | `NULL` | Soft-delete timestamp (NULL = active) |

### 2.2 Table: `timeline_versions`
Audit-trailed immutable snapshots of Edit Decision Lists (EDL).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Version UUID |
| `project_id` | `UUID` | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | Parent project |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | Creator user |
| `version_number`| `INT` | `NOT NULL` | Sequential revision number (1, 2, 3...) |
| `name` | `TEXT` | `NOT NULL DEFAULT 'Version'` | Version label |
| `description` | `TEXT` | `NULL` | Version change summary |
| `render_spec` | `JSONB` | `NOT NULL` | CanonicalRenderSpec payload |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |

### 2.3 Foreign Key Integrations
1. **`clips.source_media_id`**: Links candidate clips directly to immutable `media_assets(id)`.
2. **`transcripts.media_asset_id`**: Links Deepgram transcripts directly to `media_assets(id)`.
3. **`render_jobs.input_media_id` & `render_jobs.output_media_id`**: Links rendering jobs to input source and output renders in `media_assets(id)`.

---

## 3. Project Lifecycle State Machine

Projects transition deterministically according to strict validation guards:

```
[draft]
   ↓
[uploading]
   ↓
[processing] ──(fail)──→ [failed]
   ↓                        ↑
[ready] ←───────────────────┤
   ↓   ↖                    │
[editing] ⇄ [rendering] ────┘
   ↓
[completed]
```

### Valid Transitions
| From Status | Allowed Next Statuses | Description |
|---|---|---|
| `draft` | `uploading`, `processing`, `ready`, `editing`, `failed` | Project initialized, awaiting source media |
| `uploading` | `processing`, `ready`, `failed` | Chunks streaming to object storage |
| `processing`| `ready`, `editing`, `failed` | Probing, audio extraction, transcription, candidate discovery |
| `ready` | `editing`, `rendering`, `processing`, `completed` | Assets ready for review or timeline editing |
| `editing` | `rendering`, `ready`, `completed`, `failed` | Timeline manipulation in Studio |
| `rendering` | `ready`, `editing`, `completed`, `failed` | FFmpeg rendering in progress |
| `completed` | `editing`, `rendering`, `ready` | Final render produced; allows re-editing |
| `failed` | `draft`, `uploading`, `processing`, `ready`, `editing`| Error state; allows recovery / retry |

Any illegal transition (e.g. `draft` $\to$ `completed`) is rejected by the API layer with HTTP 400 (`INVALID_PROJECT_STATE`).

---

## 4. Optimistic Concurrency Control (OCC)

To prevent lost updates in multi-tab, collaborative, or background-sync workflows, the `projects.version` integer acts as a monotonic revision counter.

### OCC Protocol
1. Client fetches project: receives `project.version = N`.
2. Client sends modification to `PATCH /api/projects/:id` with `{ expectedVersion: N, ...updates }`.
3. Server executes atomic check:
   - If database `version !== expectedVersion`:
     - Server aborts mutation.
     - Server responds with HTTP 409 (`PROJECT_VERSION_CONFLICT`) containing `{ expectedVersion: N, currentVersion: current.version }`.
     - Client handles conflict by reloading authoritative server state.
   - If database `version === expectedVersion`:
     - Server applies updates.
     - Server increments `version = N + 1`.
     - Server returns updated project with `version: N + 1`.

---

## 5. Security & Row-Level Security (RLS)

All database operations are governed by PostgreSQL Row-Level Security.

### Policies Enforced
1. **Zero Null-Auth Loopholes:** Eradicated insecure legacy conditions (e.g., `OR auth.uid() IS NULL`). Unauthenticated requests FAIL CLOSED.
2. **Tenant Isolation:**
   ```sql
   CREATE POLICY "projects_select_tenant" ON public.projects
     FOR SELECT USING ((auth.uid() = user_id OR is_admin()) AND deleted_at IS NULL);

   CREATE POLICY "projects_modify_tenant" ON public.projects
     FOR ALL USING ((auth.uid() = user_id OR is_admin()) AND deleted_at IS NULL)
     WITH CHECK (auth.uid() = user_id OR is_admin());
   ```
3. **Media Ownership Linkage:**
   When attaching an `activeMediaId` to a project, the API validates that the media asset row belongs to `auth.uid()`. Cross-tenant asset borrowing is rejected with HTTP 403 (`MEDIA_NOT_OWNED`).
4. **Soft-Delete Enforcement:**
   Soft-deleted projects (`deleted_at IS NOT NULL`) are automatically filtered from standard queries and return HTTP 404 (`NOT_FOUND`) on direct access attempts.

---

## 6. Canonical REST API Endpoints

### 6.1 `GET /api/projects`
- **Auth:** Required (Bearer session or dev token).
- **Behavior:** Queries database filtered by `WHERE user_id = auth.uid() AND deleted_at IS NULL` (admins query all).
- **Returns:** `{ success: true, count: number, projects: Project[] }`.

### 6.2 `GET /api/projects/:id`
- **Auth:** Required. Verifies project ownership (`viewer` role minimum).
- **Behavior:** Returns single project with clips, transcript, and active version pointers.
- **Returns:** `{ success: true, project: Project }`.

### 6.3 `PATCH /api/projects/:id`
- **Auth:** Required. Verifies project ownership (`editor` role minimum).
- **Payload:** `{ title?, description?, status?, expectedVersion?, clips?, ... }`.
- **Behavior:** Validates state transitions, enforces OCC version checks, updates database.
- **Returns:** `{ success: true, project: Project }` (or HTTP 409 on conflict).

### 6.4 `DELETE /api/projects/:id`
- **Auth:** Required. Verifies ownership (`owner` role minimum).
- **Behavior:** Sets `deleted_at = NOW()`, cascades storage prefix cleanup via `StorageService.deletePrefix(...)`.
- **Returns:** `{ success: true }`.

### 6.5 `POST /api/projects/:id/duplicate`
- **Auth:** Required. Verifies access (`viewer` role minimum).
- **Behavior:** Clones project into new UUID with `(Copy)` suffix, references original immutable `active_media_id` (zero binary storage re-upload), clones clips with new UUIDs, and clones active timeline version snapshot.
- **Returns:** `{ success: true, project: Project }`.
