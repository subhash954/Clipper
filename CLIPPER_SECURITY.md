# CLIPPER SECURITY BASELINE & THREAT MODEL

**Platform:** Clipper AI Video Content Operating System  
**Version:** 1.0.0-RELEASE  
**Security Tier:** Enterprise SaaS Compliant  
**Last Audit:** October 2, 2026

---

## 1. Zero Trust Principles & Core Tenets

1. **Never Trust User Input:** All filenames, URLs, media buffers, and metadata are validated against strict whitelists before entering processing pipelines.
2. **Never Rely on Frontend Filtering:** Multi-tenant boundaries and role authorizations are verified on every API request and enforced at the database layer via PostgreSQL Row Level Security (RLS).
3. **Never Store Secrets in Plaintext:** OAuth tokens, database credentials, API keys, and third-party secrets are encrypted at rest using AES-256-GCM or hashed using SHA-256.
4. **No Shell Execution:** Media processing tools (FFmpeg, FFprobe) are spawned with typed argument arrays; shell strings (`sh -c`) are prohibited.
5. **Human-in-the-Loop Safeguards:** Autonomous AI systems cannot publish external content without explicit, authenticated human approval.

---

## 2. Authentication & Authorization Architecture

### 2.1 Server-Side Authentication (`lib/auth/serverAuth.ts`)
- Every protected route inspects session cookies or Bearer tokens.
- Anonymous requests are rejected immediately with `401 Unauthorized` (`SaasError('AUTH_REQUIRED')`).
- Session tokens include cryptographic timestamps; expired sessions are revoked.

### 2.2 Centralized RBAC Engine (`lib/saas/permissionEngine.ts`)
Permissions are evaluated strictly through `can(user, action, resource)` and `authorizeOrThrow(user, action, resource)`:

| Role | Description | Allowed Actions |
| :--- | :--- | :--- |
| **OWNER** | Organization creator | Complete administrative control, billing management, organization deletion, API key creation. |
| **ADMIN** | Workspace administrator | Member invitation, workspace configuration, client creation, webhook management. |
| **MANAGER** | Production supervisor | Project creation, review escalation, client review requests, publishing scheduling. |
| **EDITOR** | Video producer & editor | Media upload, timeline editing, RenderSpec creation, submission for review. |
| **APPROVER**| Compliance & signoff | Approval granting, rejection with notes, task resolution. |
| **CLIENT** | External brand contact | Read-only access to client portal, timestamped video comments, client approval. |
| **VIEWER** | Read-only stakeholder | View published content and verified performance metrics. |

### 2.3 Row Level Security (RLS)
PostgreSQL tables enforce tenant isolation policies:
```sql
CREATE POLICY workspace_isolation_policy ON media_assets
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );
```
Direct access to another tenant's rows is blocked by the database engine regardless of query parameters.

---

## 3. Media Ingestion & Command Execution Security

### 3.1 Binary Magic Byte Validation (`lib/enterprise/mediaLifecycle.ts`)
Uploaded media files are validated at the byte level before storage:
- **MP4:** Requires `ftyp` at offset 4 (`buffer.subarray(4, 8).toString('ascii') === 'ftyp'`).
- **WebM / MKV:** Requires EBML identifier `0x1A 0x45 0xDF 0xA3` at offset 0.
- Binary payloads failing container signature verification are rejected with `400 Bad Request`.

### 3.2 FFmpeg Injection Prevention (`lib/ffmpeg/ffmpegWrapper.ts`)
All FFmpeg and FFprobe processes are invoked via `child_process.spawn`:
```typescript
// SECURE: Explicit argument array without shell expansion
const child = spawn('ffmpeg', [
  '-ss', String(startTime),
  '-t', String(duration),
  '-i', sanitizedInputPath,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '22',
  sanitizedOutputPath
]);
```
- Shell characters (`;`, `|`, `&`, `$`, `` ` ``) are treated as literal strings and cannot execute arbitrary code.
- Output paths are strictly generated server-side using secure UUIDs.

---

## 4. Network Security & SSRF Protection

### 4.1 URL Whitelisting & Ingestion (`lib/media/urlValidator.ts`)
When accepting external media URLs (e.g. YouTube ingestion or webhooks):
1. **Protocol Restriction:** Only `https:` URLs are accepted.
2. **Private Network Blocking:** URLs resolving to private or loopback ranges (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` AWS metadata) are rejected immediately.
3. **DNS Rebinding Protection:** The target IP address is resolved and validated prior to making outgoing requests.

---

## 5. Cryptographic Vault & API Security

### 5.1 AES-256-GCM Token Encryption (`lib/publishing/tokenService.ts`)
Social platform OAuth access and refresh tokens are encrypted at rest:
- **Algorithm:** AES-256-GCM.
- **Key Derivation:** Secrets derived from high-entropy environment variables.
- **Integrity Tag:** Each encrypted payload contains an initialization vector (IV) and a 16-byte authentication tag to detect tampering.

### 5.2 API Key Vault (`lib/saas/securityEngine.ts`)
- Developer API keys use the prefix `clp_live_` followed by 32 random bytes.
- Only the SHA-256 hash of the secret is persisted in the database.
- Keys are authenticated in constant time (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

### 5.3 Sliding Window Rate Limiting (`lib/saas/securityEngine.ts`)
- Protects public and agency API endpoints against brute force and resource exhaustion.
- Enforces requests-per-minute quotas per API key and per IP address.

### 5.4 Webhook HMAC Signatures (`lib/saas/webhookDispatcher.ts`, `lib/saas/billingProvider.ts`)
- Incoming Stripe and Paddle webhooks verify HMAC-SHA256 signatures against the raw request body.
- Outgoing webhooks compute an HMAC-SHA256 signature in the `X-Clipper-Signature` header.
- Replay attacks are prevented using unique webhook delivery IDs and event timestamps.

---

## 6. Autonomous Agent Governance & Safeguards

### 6.1 Human Approval Boundary (`lib/enterprise/contentAgent.ts`)
Autonomous content generation pipelines (extracting hooks, compiling RenderSpecs, generating platform copy) execute unattended up to the publication step.
- When an asset reaches the syndication stage, the agent sets the status to `REQUIRES_APPROVAL`.
- The agent halts execution until an authorized user with `APPROVER`, `MANAGER`, `ADMIN`, or `OWNER` permissions signs off.
- Automated bypasses of this boundary are prohibited in production environments.

### 6.2 Anomaly & Cost Threshold Detection (`lib/enterprise/policyEngine.ts`)
- Workspaces monitor AI and rendering costs.
- If daily spend exceeds $2.5\times$ the historical 7-day baseline, automatic processing is suspended, and security administrators are alerted.
