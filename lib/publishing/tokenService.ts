/**
 * CLIPPER SOCIAL PUBLISHING — ENCRYPTED TOKEN VAULT SERVICE
 * Phase 1, 4, 5, 29
 * 
 * Implements server-side AES-256-GCM authenticated encryption for OAuth access & refresh tokens.
 * Zero plaintext credentials exposed to client-side code or raw database queries.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EncryptedTokenVaultEntry } from './types';

const VAULT_DIR = path.join(process.cwd(), 'data', 'publishing');
const VAULT_FILE = path.join(VAULT_DIR, 'token_vault.json');

// Derive 32-byte AES key from environment or deterministic server salt
const SECRET_PASSPHRASE = process.env.ENCRYPTION_KEY || 'clipper-production-publishing-secret-salt-2026';
const MASTER_KEY = crypto.scryptSync(SECRET_PASSPHRASE, 'clipper-salt-v1', 32);

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

function readVault(): Record<string, EncryptedTokenVaultEntry> {
  ensureVaultDir();
  if (!fs.existsSync(VAULT_FILE)) {
    fs.writeFileSync(VAULT_FILE, JSON.stringify({}, null, 2), 'utf-8');
    return {};
  }
  try {
    const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeVault(vault: Record<string, EncryptedTokenVaultEntry>) {
  ensureVaultDir();
  fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), 'utf-8');
}

/**
 * Encrypts a raw OAuth token string using AES-256-GCM
 */
export function encryptToken(
  rawToken: string,
  expiresInSeconds: number = 3600
): { referenceId: string; entry: EncryptedTokenVaultEntry } {
  const referenceId = `tok-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const iv = crypto.randomBytes(12); // 96-bit IV standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);

  let ciphertext = cipher.update(rawToken, 'utf-8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const entry: EncryptedTokenVaultEntry = {
    referenceId,
    ciphertext,
    iv: iv.toString('hex'),
    tag,
    expiresAt,
    updatedAt: new Date().toISOString(),
  };

  const vault = readVault();
  vault[referenceId] = entry;
  writeVault(vault);

  return { referenceId, entry };
}

/**
 * Decrypts a token from its vault reference ID
 */
export function decryptToken(referenceId: string): string | null {
  const vault = readVault();
  const entry = vault[referenceId];
  if (!entry) return null;

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      MASTER_KEY,
      Buffer.from(entry.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));

    let decrypted = decipher.update(entry.ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  } catch (err) {
    console.error(`Token decryption failed for reference ${referenceId}:`, err);
    return null;
  }
}

/**
 * Validates whether a token reference is still unexpired
 */
export function isTokenValid(referenceId: string): boolean {
  const vault = readVault();
  const entry = vault[referenceId];
  if (!entry) return false;
  return new Date(entry.expiresAt).getTime() > Date.now();
}

/**
 * Revokes / deletes an encrypted token from the vault
 */
export function revokeToken(referenceId: string): boolean {
  const vault = readVault();
  if (!vault[referenceId]) return false;
  delete vault[referenceId];
  writeVault(vault);
  return true;
}
