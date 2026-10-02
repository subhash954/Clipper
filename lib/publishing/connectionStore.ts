/**
 * CLIPPER SOCIAL PUBLISHING — CONNECTION STORE
 * Phase 1, 2, 4, 29
 * 
 * Manages SocialConnection records with workspace isolation.
 * Tokens are never stored in raw text; encrypted vault references are used.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SocialConnection, ConnectionStatus } from './types';
import { encryptToken, isTokenValid, revokeToken } from './tokenService';
import { SupportedPlatform } from '@/lib/factory/types';

const STORE_DIR = path.join(process.cwd(), 'data', 'publishing');
const STORE_FILE = path.join(STORE_DIR, 'connections.json');

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readConnections(): SocialConnection[] {
  ensureStoreDir();
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeConnections(connections: SocialConnection[]) {
  ensureStoreDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(connections, null, 2), 'utf-8');
}

export interface ConnectAccountParams {
  workspaceId: string;
  platform: SupportedPlatform;
  accountId: string;
  accountName: string;
  accountHandle: string;
  rawAccessToken: string;
  rawRefreshToken?: string;
  expiresInSeconds?: number;
  scopes: string[];
}

/**
 * Creates or updates a verified social connection with encrypted token storage.
 */
export function connectSocialAccount(params: ConnectAccountParams): SocialConnection {
  const connections = readConnections();

  // Encrypt the tokens via server-side vault
  const { referenceId: tokenReference, entry: tokenEntry } = encryptToken(
    params.rawAccessToken,
    params.expiresInSeconds || 3600
  );

  let refreshTokenReference: string | undefined;
  if (params.rawRefreshToken) {
    const refreshEntry = encryptToken(params.rawRefreshToken, 30 * 24 * 3600); // 30 days
    refreshTokenReference = refreshEntry.referenceId;
  }

  // Look for existing connection for this workspace + platform + accountId
  const existingIdx = connections.findIndex(
    (c) =>
      c.workspaceId === params.workspaceId &&
      c.platform === params.platform &&
      c.accountId === params.accountId
  );

  const now = new Date().toISOString();
  const connection: SocialConnection = {
    id: existingIdx >= 0 ? connections[existingIdx].id : `conn-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    workspaceId: params.workspaceId,
    platform: params.platform,
    accountId: params.accountId,
    accountName: params.accountName,
    accountHandle: params.accountHandle,
    status: 'CONNECTED',
    scopes: params.scopes,
    tokenReference,
    tokenExpiresAt: tokenEntry.expiresAt,
    refreshTokenReference,
    connectedAt: existingIdx >= 0 ? connections[existingIdx].connectedAt : now,
    lastValidatedAt: now,
    createdAt: existingIdx >= 0 ? connections[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    // Revoke old token references
    if (connections[existingIdx].tokenReference) {
      revokeToken(connections[existingIdx].tokenReference);
    }
    if (connections[existingIdx].refreshTokenReference) {
      revokeToken(connections[existingIdx].refreshTokenReference);
    }
    connections[existingIdx] = connection;
  } else {
    connections.push(connection);
  }

  writeConnections(connections);
  return connection;
}

/**
 * Lists connections for a given workspace, checking live token expiration status.
 */
export function listConnections(workspaceId: string): SocialConnection[] {
  const connections = readConnections();
  let updated = false;

  const result = connections
    .filter((c) => c.workspaceId === workspaceId)
    .map((conn) => {
      // Validate token status
      const valid = isTokenValid(conn.tokenReference);
      if (!valid && conn.status === 'CONNECTED') {
        conn.status = 'EXPIRED';
        conn.updatedAt = new Date().toISOString();
        updated = true;
      }
      return conn;
    });

  if (updated) {
    writeConnections(connections);
  }

  return result;
}

/**
 * Gets a specific connection by ID with workspace verification.
 */
export function getConnection(id: string, workspaceId: string): SocialConnection | null {
  const connections = readConnections();
  const conn = connections.find((c) => c.id === id && c.workspaceId === workspaceId);
  if (!conn) return null;

  // Check token status
  if (!isTokenValid(conn.tokenReference) && conn.status === 'CONNECTED') {
    conn.status = 'EXPIRED';
    conn.updatedAt = new Date().toISOString();
    writeConnections(connections);
  }

  return conn;
}

/**
 * Disconnects / revokes an account connection and removes its credentials from vault.
 */
export function disconnectAccount(id: string, workspaceId: string): boolean {
  const connections = readConnections();
  const idx = connections.findIndex((c) => c.id === id && c.workspaceId === workspaceId);
  if (idx === -1) return false;

  const conn = connections[idx];
  if (conn.tokenReference) revokeToken(conn.tokenReference);
  if (conn.refreshTokenReference) revokeToken(conn.refreshTokenReference);

  connections.splice(idx, 1);
  writeConnections(connections);
  return true;
}

/**
 * Marks connection status (e.g. REAUTH_REQUIRED or ERROR)
 */
export function updateConnectionStatus(
  id: string,
  workspaceId: string,
  status: ConnectionStatus
): SocialConnection | null {
  const connections = readConnections();
  const conn = connections.find((c) => c.id === id && c.workspaceId === workspaceId);
  if (!conn) return null;

  conn.status = status;
  conn.updatedAt = new Date().toISOString();
  writeConnections(connections);
  return conn;
}
