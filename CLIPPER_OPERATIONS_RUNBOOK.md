# CLIPPER OPERATIONS RUNBOOK

**Target Environment:** Production  
**Classification:** Standard Operating Procedures (SOP)  
**Version:** 1.0.0-RELEASE  
**Last Updated:** October 2, 2026

---

## 1. Production Deployment Procedure

### 1.1 Pre-Deployment Verification
Before initiating any deployment to staging or production:
1. Verify working directory status:
   ```bash
   git status
   ```
2. Run full test suite with single concurrency to verify zero race conditions:
   ```bash
   npx tsx --test --test-concurrency=1 tests/*.test.ts
   ```
   **Requirement:** 299/299 tests passing, 0 failures.
3. Run Next.js production build:
   ```bash
   npm run build
   ```
   **Requirement:** 55/55 routes compiled with 0 TypeScript/ESLint errors.

### 1.2 Deployment Steps
1. Apply database migrations:
   ```bash
   npx supabase db push
   ```
2. Build and tag container image:
   ```bash
   docker build -t clipper-app:v1.0.0 .
   ```
3. Deploy canary or rolling update across cluster:
   ```bash
   kubectl set image deployment/clipper-app app=clipper-app:v1.0.0
   ```
4. Verify health endpoints:
   ```bash
   curl -f http://localhost:3000/api/agency/health
   ```

---

## 2. Emergency Rollback Procedure

### 2.1 Criteria for Immediate Rollback
- Production HTTP 5xx rate exceeds $1\%$ over a 5-minute rolling window.
- Database migration failures or unhandled exceptions in the job queue.
- Worker nodes experiencing crash loops during FFmpeg rendering.

### 2.2 Execution Steps
1. Roll back the Kubernetes deployment to previous revision:
   ```bash
   kubectl rollout undo deployment/clipper-app
   ```
2. Verify rollback status:
   ```bash
   kubectl rollout status deployment/clipper-app
   ```
3. If database schema was altered, apply reverse migration scripts located in `supabase/migrations/revert/`.

---

## 3. Queue Recovery & Worker Crash Procedures

### 3.1 Orphaned Job Recovery
When a rendering or publishing worker node crashes ungracefully, the job remains in `LEASED` status until the lease expires.
- **Automatic Recovery:** The `EnterpriseJobQueue` automatically scans for expired leases during each `leaseNextJob()` call and recovers them to `QUEUED`.
- **Manual Trigger:** Run the manual recovery routine via CLI or administrator endpoint:
  ```typescript
  import { getEnterpriseJobQueue } from './lib/enterprise/jobQueue';
  const queue = getEnterpriseJobQueue();
  const recovered = await queue.recoverOrphanedJobs();
  console.log(`Recovered ${recovered} orphaned jobs back to QUEUED.`);
  ```

### 3.2 Dead Letter Queue (DLQ) Redrive
Jobs that exceed their maximum retry limit (default: 3) enter the `DEAD_LETTER` state.
1. Inspect dead letter jobs:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/admin/dlq
   ```
2. Diagnose root cause (e.g. invalid video codec, corrupted header, exhausted rate limits).
3. Redrive single job:
   ```typescript
   await queue.retryDeadLetterJob(jobId);
   ```

---

## 4. Third-Party Provider Outage Procedures

### 4.1 Gemini AI Provider Outage
- **Automatic Behavior:** When 3 consecutive AI requests fail, the circuit breaker transitions to `OPEN`. All incoming requests automatically fail over to secondary providers (e.g. backup LLM) or return degraded local responses.
- **Operational Verification:**
  1. Inspect circuit breaker status:
     ```typescript
     const status = aiRegistry.getCircuitStatus('gemini');
     console.log(status.circuitState); // 'OPEN' | 'HALF_OPEN' | 'CLOSED'
     ```
  2. While `OPEN`, content creation and editing in the Studio remain operational.

### 4.2 Deepgram Transcription Outage
- When transcription is unavailable, video uploads are stored safely in S3.
- The transcription task enters exponential backoff retry.
- Once Deepgram recovers, worker nodes resume transcription jobs in FIFO order.

---

## 5. Database Backup & Disaster Recovery

### 5.1 Automated Snapshots
- Point-In-Time Recovery (PITR) is enabled with 30-day retention on PostgreSQL.
- Daily logical backups (`pg_dump`) are written to encrypted, cross-region S3 storage.

### 5.2 Manual Backup Command
```bash
pg_dump -Fc --no-acl --no-owner -h $DB_HOST -U $DB_USER -d $DB_NAME > clipper_backup_$(date +%Y%m%d_%H%M%S).dump
```

### 5.3 Database Restore Procedure
1. Create isolated recovery instance.
2. Restore from snapshot:
   ```bash
   pg_restore --clean --if-exists -h $RECOVERY_HOST -U $DB_USER -d $DB_NAME backup_file.dump
   ```
3. Verify data integrity:
   - Check total organization count against `ProductAnalytics`.
   - Verify cryptographic hash consistency on media asset tables.
4. Update application connection strings to point to the recovered database instance.
