# CLIPPER INCIDENT RESPONSE PLAYBOOK

**Document:** Incident Management Standard Operating Procedures  
**Severity Levels:** SEV-1 (Critical Outage / Data Breach) to SEV-4 (Minor Bug)  
**Last Updated:** October 2, 2026

---

## 1. Incident Severity Definitions & Escalation

| Severity | Definition | Target Response | Target Resolution | Escalation Contact |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1** | Tenant isolation leak, credential compromise, active remote code execution, total service outage. | $< 15$ mins | $< 2$ hours | Security Lead, CTO, On-Call Engineer |
| **SEV-2** | External publishing failure affecting all users, rendering pipeline halted, billing webhook desync. | $< 30$ mins | $< 4$ hours | Engineering Lead, Infrastructure On-Call |
| **SEV-3** | Individual platform adapter degraded, single tenant quota calculation issue. | $< 2$ hours | $< 24$ hours | Feature Team On-Call |
| **SEV-4** | Non-blocking UI glitch, minor documentation errata. | Next Business Day | Next Sprint | Issue Tracker |

---

## 2. Standard Operating Procedures (SOP) by Incident Type

### 2.1 Credential Leak Protocol (SEV-1)
*Applies to: Database credentials, OAuth client secrets, Master encryption keys, AWS keys.*

1. **Immediate Containment:**
   - Invalidate the leaked credential at the provider portal (e.g. Google Cloud, AWS IAM, Supabase).
   - Terminate active sessions associated with the compromised credential.
2. **Key Rotation:**
   - Generate high-entropy replacement secret.
   - Update environment variables across deployment secrets / vault:
     ```bash
     kubectl create secret generic clipper-secrets --from-literal=MASTER_KEY=$NEW_KEY --dry-run=client -o yaml | kubectl apply -f -
     ```
   - Trigger zero-downtime rolling restart of all container instances.
3. **Forensic Audit:**
   - Search audit logs (`AuditLogEntry`) for unauthorized access within the exposure window.
   - Notify impacted stakeholders if customer data was accessed.

---

### 2.2 Tenant Isolation Incident Protocol (SEV-1)
*Applies to: Any scenario where Organization A accesses assets or data of Organization B.*

1. **Immediate Lockdown:**
   - Identify the vulnerable endpoint or database policy.
   - Deploy emergency hotfix or enable maintenance mode on the affected route:
     ```typescript
     // Emergency patch in permissionEngine or serverAuth
     if (isCompromisedRoute(req)) return NextResponse.json({ error: 'Maintenance' }, { status: 503 });
     ```
2. **Access Audit:**
   - Query access logs filtering for cross-organization resource identifiers.
   - Document precisely what rows were read or modified.
3. **Remediation & Testing:**
   - Patch database RLS policy or application authorization check.
   - Add regression test case in `tests/saas.test.ts` to verify cross-tenant access returns `403 FORBIDDEN`.

---

### 2.3 Data Loss & Corruption Incident Protocol (SEV-1)
*Applies to: Accidental deletion, storage corruption, unrecoverable database state.*

1. **Freeze Writes:**
   - Place database or storage bucket in read-only mode to prevent propagation of corruption.
2. **Identify Last Known Good State:**
   - Inspect Point-In-Time Recovery (PITR) timestamps.
3. **Restore & Reconciliation:**
   - Restore database from PITR snapshot to a staging recovery cluster.
   - Run cryptographic hash verification on media assets.
   - Replay transactional outbox events logged after the snapshot timestamp to recover transactions.

---

### 2.4 AI Provider Compromise or Sudden Deprecation (SEV-2)
*Applies to: Deepgram or Gemini API returning unauthorized, invalid payloads, or security alerts.*

1. **Trip Circuit Breakers Manually:**
   - Switch AI provider registry mode to secondary model:
     ```typescript
     aiRegistry.recordProviderFailure('gemini');
     aiRegistry.recordProviderFailure('gemini');
     aiRegistry.recordProviderFailure('gemini');
     // Circuit breaker trips to OPEN
     ```
2. **Traffic Redirection:**
   - Verify all candidate extraction requests route to fallback model.
3. **Customer Notification:**
   - Display non-intrusive status banner indicating AI analysis is running in fallback mode.

---

### 2.5 Billing & Webhook Replay Incident (SEV-2)
*Applies to: Stripe or Paddle sending duplicate webhook events or forged signatures.*

1. **Verify Signature Security:**
   - Check webhook controller logs to verify HMAC-SHA256 signature rejection rate.
2. **Idempotency Safeguard:**
   - Confirm that duplicate webhook event IDs are rejected via `BillingProvider.recordWebhookEvent()`.
3. **Subscription Reconciliation:**
   - Query payment provider API directly to synchronize active subscription statuses.

---

### 2.6 Runaway Publishing Incident (SEV-2)
*Applies to: Publishing queue double-posting or posting unapproved content.*

1. **Pause Publishing Queue:**
   - Temporarily pause worker leasing for `PUBLISH` job type:
     ```bash
     kubectl scale deployment clipper-publisher --replicas=0
     ```
2. **Purge Unauthorized Scheduled Posts:**
   - Cancel unexecuted jobs in `data/publishing/jobs.json` or database table.
3. **External Platform Remediation:**
   - Invoke platform adapter `deletePost()` methods using recorded external post IDs.
