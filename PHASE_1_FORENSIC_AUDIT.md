# CLIPPER PHASE 1: FORENSIC REPOSITORY AUDIT

**Audit Date:** October 2, 2026  
**Auditor:** Clipper Master Engineering Agent  
**Repository:** https://github.com/subhash954/Clipper  
**Target:** Core Truth + Production Hardening Pass (Zero New Features)

---

## 1. Audit Scope & Methodology

A forensic scan of the entire repository was conducted across `app/`, `components/`, `lib/`, `supabase/`, `tests/`, and configuration files. Every occurrence of synthetic fallbacks, unverified mocks, localStorage reliance, authorization shortcuts, in-memory queues, and unvalidated environment assumptions was cataloged.

---

## 2. Forensic Findings Log

### Finding 1: In-Memory Authoritative Render Queue with Swallowed Persistence
- **File:** `lib/renderJobs.ts`
- **Location:** Lines 6, 46–51, 96–101
- **Problem:** `const activeJobs = new Map<string, RenderJob>()` acts as the primary queue. Persistence errors to Supabase/storage are swallowed with `console.warn('Could not persist render job to database:', err)`.
- **Severity:** `CRITICAL`
- **Why Dangerous:** If the application process restarts or runs multi-instance, active jobs are lost. The client is told a render job exists when it was never durably recorded.
- **Proposed Fix:** Make database/durable storage authoritative. Fail the operation immediately (`throw new ClipperError('STORAGE_UNAVAILABLE', ...)`) if job creation cannot be persisted. Remove reliance on uncoordinated memory maps.
- **Status:** FIXING

### Finding 2: Synthetic Media Fallback Behavior & Missing Structured Error
- **File:** `lib/renderEngine.ts`
- **Location:** Lines 308–315
- **Problem:** Missing media throws a generic `Error` rather than returning a structured `MEDIA_UNAVAILABLE` error with non-retryable metadata.
- **Severity:** `HIGH`
- **Why Dangerous:** Downstream callers and UI cannot distinguish missing source media from recoverable transcoding glitches.
- **Proposed Fix:** Introduce `ClipperError` with `{ code: 'MEDIA_UNAVAILABLE', message: 'Source media could not be resolved.', retryable: false }` and eliminate any synthetic video generation path.
- **Status:** FIXING

### Finding 3: Unsafe Storage Fallback in Production
- **File:** `lib/storage/index.ts`
- **Location:** Lines 430–444
- **Problem:** `getStorage()` defaults to `LocalStorageAdapter` (local JSON files) if Supabase is unconfigured, governed only by a loose `ALLOW_DEV_LOCAL_STORAGE` flag.
- **Severity:** `CRITICAL`
- **Why Dangerous:** A production deployment without PostgreSQL can silently write user data to ephemeral local container disk, resulting in silent data loss on pod restart.
- **Proposed Fix:** Introduce explicit `STORAGE_MODE=supabase | local`. In production (`NODE_ENV === 'production'`), reject `STORAGE_MODE=local` and fail closed immediately.
- **Status:** FIXING

### Finding 4: Nullable Project and Job Ownership Bypass
- **File:** `lib/storage/index.ts`
- **Location:** Lines 38 (`user_id: project.userId || null`), Line 216 (`user_id: job.userId || null`)
- **Problem:** Database upserts permit `user_id` to be `null`.
- **Severity:** `HIGH`
- **Why Dangerous:** `user_id = null` records either become orphan assets or trigger security vulnerabilities in RLS queries.
- **Proposed Fix:** Enforce `user_id NOT NULL` across `saveProject` and `createRenderJob`. Throw `VALIDATION_ERROR` if an unowned project is submitted.
- **Status:** FIXING

### Finding 5: Development Identity Bypass Leaking All Projects
- **File:** `app/api/projects/route.ts`
- **Location:** Line 35 (`if (user.isDevUser) return true;`)
- **Problem:** In non-production environments, `GET /api/projects` returns all projects across all users.
- **Severity:** `HIGH`
- **Why Dangerous:** Developers and automated tests see cross-tenant data leaks, hiding tenant isolation bugs.
- **Proposed Fix:** Remove `user.isDevUser` bypass in `app/api/projects/route.ts`. Filter strictly by `p.userId === user.id` (or verify admin role).
- **Status:** FIXING

### Finding 6: Authorization Bypass on Render Job Querying
- **File:** `app/api/render/[jobId]/route.ts`
- **Location:** Line 26 (`if (job.userId && job.userId !== user.id && user.role !== 'admin' && !user.isDevUser)`)
- **Problem:** If a job has no `userId`, or if `user.isDevUser` is set, any user can inspect any render job.
- **Severity:** `HIGH`
- **Why Dangerous:** Predictable or shared job IDs allow unauthorized users to inspect render URLs and status.
- **Proposed Fix:** Require every render job to have a `userId`. Reject with 403 or 404 if `job.userId !== user.id` (unless user has admin role).
- **Status:** FIXING

### Finding 7: Missing Project Requirement on Render Creation
- **File:** `app/api/render/route.ts`
- **Location:** Lines 32–38, 95–100
- **Problem:** `projectId` is optional. If omitted, `requireProjectAccess` is skipped, creating unattached render jobs.
- **Severity:** `HIGH`
- **Why Dangerous:** Allows rendering arbitrary media without project ownership or quota tracking.
- **Proposed Fix:** Require `projectId` on every render creation request and verify ownership.
- **Status:** FIXING

### Finding 8: Client-Side LocalStorage Acting as Authoritative State
- **File:** `app/studio/page.tsx`, `app/dashboard/page.tsx`
- **Location:** `app/studio/page.tsx` Lines 208, 266; `app/dashboard/page.tsx` Line 54
- **Problem:** Studio loads the active project from `localStorage.getItem('clipper_active_project')` if URL query param is absent. Dashboard writes the full project object to localStorage.
- **Severity:** `MEDIUM`
- **Why Dangerous:** Client localStorage can be stale, manipulated, or out of sync with database ownership.
- **Proposed Fix:** Studio must be accessed via `/studio?projectId=...` and fetch the authoritative project from `/api/projects?id=...`. LocalStorage may only store user UI preferences (e.g. editor theme, zoom level).
- **Status:** FIXING

### Finding 9: Automatic Timeout Fallback to Demo Data
- **File:** `app/studio/page.tsx`
- **Location:** Lines 290–305
- **Problem:** If a project does not load, a `setTimeout` timer automatically sets `setVideoUrl(DEMO_VIDEO_URL)`, `setWords(DEMO_WORDS)`, and `setClips(DEMO_VIRAL_CLIPS)`.
- **Severity:** `HIGH`
- **Why Dangerous:** Masking backend failures by silently substituting demo footage violates Rule Zero.
- **Proposed Fix:** Remove the timeout fallback. Show an explicit error state (`Project not found or failed to load`). Demo media may only be loaded when the user explicitly clicks "⚡ Try With Instant Sample Video".
- **Status:** FIXING

### Finding 10: Non-Persistent Dashboard Duplicate Action
- **File:** `app/dashboard/page.tsx`
- **Location:** Lines 77–86
- **Problem:** `handleDuplicateProject` creates a local state copy with `crypto.randomUUID()` without persisting it to `/api/projects`.
- **Severity:** `MEDIUM`
- **Why Dangerous:** Refreshing the browser causes the duplicated project to disappear.
- **Proposed Fix:** Implement real backend duplicate endpoint or POST to `/api/projects` with real database persistence.
- **Status:** FIXING

### Finding 11: Hardcoded Unit Economics in Client Code
- **File:** `app/studio/page.tsx` Line 247–252, `lib/db.ts` Line 31–36
- **Problem:** Costs are hardcoded (`deepgramSTTCost: 0.19, geminiFlashLLMCost: 0.002, totalCostUSD: 0.35`).
- **Severity:** `LOW`
- **Why Dangerous:** Falsely presents hardcoded numbers as calculated real-time telemetry.
- **Proposed Fix:** Ensure all costs are attributed from actual usage telemetry or explicitly flagged as `isEstimated: true`.
- **Status:** FIXING

### Finding 12: Package Identity Discrepancy
- **File:** `package.json`
- **Location:** Line 2 (`"name": "vidviral-clipstudio"`)
- **Problem:** Package identity still reflects legacy temporary name.
- **Severity:** `LOW`
- **Why Dangerous:** Inconsistency across build logs and package manifests.
- **Proposed Fix:** Rename package to `"clipper"`.
- **Status:** FIXING

---

## 3. Action Plan & Priority Order

1. **Step 2:** Create `lib/errors.ts` and refactor `lib/renderEngine.ts` to return structured `MEDIA_UNAVAILABLE` on missing media.
2. **Step 3:** Enforce `STORAGE_MODE` with fail-closed production check in `lib/storage/index.ts`.
3. **Step 4 & 5:** Enforce project and job ownership (`user_id NOT NULL`) and remove dev identity bypass in `app/api/projects/route.ts` and `lib/auth/serverAuth.ts`.
4. **Step 8, 9, 10:** Refactor `lib/renderJobs.ts` into a database-backed, state-machine-validated engine with ownership enforcement.
5. **Step 11 & 12:** Audit and sanitize `app/studio/page.tsx` and `app/dashboard/page.tsx` (remove localStorage authority and automatic demo timeout fallback).
6. **Step 15 & 16:** Implement environment validation and advanced SSRF protections.
7. **Step 20 & 21:** Implement real project duplication and real deletion in API and dashboard.
8. **Step 22:** Clean up `package.json`.
9. **Step 25 & 26:** Author `tests/phase1_hardening.test.ts` with all 20 test points and verify real video E2E pipeline.
10. **Step 27:** Compile `PHASE_1_COMPLETION_REPORT.md`.
