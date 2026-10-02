import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ApiKeyRecord,
  PermissionAction,
  SecuritySession,
  SaasError,
} from './types';

// Rate limit thresholds (requests per minute)
const RATE_LIMIT_CONFIG = {
  read: { limit: 120, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  render: { limit: 10, windowMs: 60_000 },
  ai: { limit: 20, windowMs: 60_000 },
  publish: { limit: 15, windowMs: 60_000 },
};

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class SecurityEngine {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private apiKeysFile = path.join(process.cwd(), 'data', 'saas', 'api_keys.json');
  private sessionsFile = path.join(process.cwd(), 'data', 'saas', 'sessions.json');
  private rateLimitMap = new Map<string, RateLimitBucket>();

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // --- API KEYS ---

  /**
   * Generates a new cryptographically secure API key.
   * Returns the raw secret ONLY ONCE to caller.
   */
  async createApiKey(
    organizationId: string,
    workspaceId: string,
    name: string,
    permissions: PermissionAction[],
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKeyRecord; rawSecret: string }> {
    const rawSecret = `clp_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawSecret.substring(0, 16);
    const hashedSecret = crypto.createHash('sha256').update(rawSecret).digest('hex');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const apiKey: ApiKeyRecord = {
      id: crypto.randomUUID(),
      organizationId,
      workspaceId,
      keyPrefix,
      hashedSecret,
      name,
      permissions,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    const keys = this.read<ApiKeyRecord>(this.apiKeysFile);
    keys.push(apiKey);
    this.write(this.apiKeysFile, keys);

    return { apiKey, rawSecret };
  }

  /**
   * Verifies an incoming raw API secret.
   * Updates lastUsedAt if valid.
   */
  async verifyApiKey(rawSecret: string): Promise<ApiKeyRecord | null> {
    if (!rawSecret.startsWith('clp_live_')) return null;

    const hashed = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const keys = this.read<ApiKeyRecord>(this.apiKeysFile);
    const match = keys.find(k => k.hashedSecret === hashed);

    if (!match) return null;

    // Check expiration
    if (match.expiresAt && new Date(match.expiresAt).getTime() < Date.now()) {
      return null;
    }

    // Update lastUsedAt
    match.lastUsedAt = new Date().toISOString();
    this.write(this.apiKeysFile, keys);
    return match;
  }

  async listApiKeys(organizationId: string): Promise<Omit<ApiKeyRecord, 'hashedSecret'>[]> {
    const keys = this.read<ApiKeyRecord>(this.apiKeysFile);
    return keys
      .filter(k => k.organizationId === organizationId)
      .map(({ hashedSecret, ...rest }) => rest);
  }

  async revokeApiKey(id: string, organizationId: string): Promise<boolean> {
    let keys = this.read<ApiKeyRecord>(this.apiKeysFile);
    const initialLen = keys.length;
    keys = keys.filter(k => !(k.id === id && k.organizationId === organizationId));
    this.write(this.apiKeysFile, keys);
    return keys.length < initialLen;
  }

  // --- RATE LIMITING ---

  /**
   * Evaluates rate limiting per identifier and operation type
   */
  checkRateLimit(
    identifier: string,
    type: 'read' | 'write' | 'render' | 'ai' | 'publish'
  ): { allowed: boolean; remaining: number; resetMs: number } {
    const config = RATE_LIMIT_CONFIG[type];
    const key = `${identifier}:${type}`;
    const now = Date.now();

    let bucket = this.rateLimitMap.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + config.windowMs };
      this.rateLimitMap.set(key, bucket);
    }

    if (bucket.count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, bucket.resetAt - now),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: config.limit - bucket.count,
      resetMs: Math.max(0, bucket.resetAt - now),
    };
  }

  assertRateLimit(identifier: string, type: 'read' | 'write' | 'render' | 'ai' | 'publish'): void {
    const res = this.checkRateLimit(identifier, type);
    if (!res.allowed) {
      throw new SaasError(
        'RATE_LIMITED',
        `Rate limit exceeded for '${type}' requests. Try again in ${Math.ceil(res.resetMs / 1000)}s.`,
        429,
        { retryAfterSeconds: Math.ceil(res.resetMs / 1000) }
      );
    }
  }

  // --- SESSIONS & DEVICE SECURITY ---

  async registerSession(userId: string, organizationId: string, ipAddress: string, deviceInfo: string): Promise<SecuritySession> {
    const sessions = this.read<SecuritySession>(this.sessionsFile);
    const session: SecuritySession = {
      id: crypto.randomUUID(),
      userId,
      organizationId,
      deviceInfo,
      ipAddress,
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      isRevoked: false,
    };

    sessions.push(session);
    this.write(this.sessionsFile, sessions);
    return session;
  }

  async listActiveSessions(organizationId: string): Promise<SecuritySession[]> {
    const sessions = this.read<SecuritySession>(this.sessionsFile);
    return sessions.filter(s => s.organizationId === organizationId && !s.isRevoked && new Date(s.expiresAt).getTime() > Date.now());
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const sessions = this.read<SecuritySession>(this.sessionsFile);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return false;

    session.isRevoked = true;
    this.write(this.sessionsFile, sessions);
    return true;
  }
}

// Singleton
let securityEngineInstance: SecurityEngine | null = null;

export function getSecurityEngine(): SecurityEngine {
  if (!securityEngineInstance) {
    securityEngineInstance = new SecurityEngine();
  }
  return securityEngineInstance;
}
