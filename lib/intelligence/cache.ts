import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { IntelligenceReport } from './types';

const CACHE_DIR = path.join(process.cwd(), 'data', 'intelligence_cache');

/**
 * Computes deterministic SHA-256 analysis hash across media fingerprint,
 * full transcript text, and engine model configuration.
 */
export function computeAnalysisHash(params: {
  mediaIdentifier: string;
  transcriptText: string;
  configVersion?: string;
  modelVersion?: string;
}): string {
  const {
    mediaIdentifier,
    transcriptText,
    configVersion = 'v3.0.0',
    modelVersion = 'gemini-2.5-flash+ffmpeg-7.0',
  } = params;

  const hash = crypto.createHash('sha256');
  hash.update(mediaIdentifier);
  hash.update(transcriptText.trim());
  hash.update(configVersion);
  hash.update(modelVersion);

  return hash.digest('hex');
}

/**
 * Memory cache for low-latency lookups
 */
const memoryCache = new Map<string, IntelligenceReport>();

/**
 * Retrieves cached intelligence report if available
 */
export async function getCachedIntelligence(analysisHash: string): Promise<IntelligenceReport | null> {
  // 1. Check memory cache
  if (memoryCache.has(analysisHash)) {
    return memoryCache.get(analysisHash)!;
  }

  // 2. Check local disk cache
  try {
    const cacheFilePath = path.join(CACHE_DIR, `${analysisHash}.json`);
    if (fs.existsSync(/*turbopackIgnore: true*/ cacheFilePath)) {
      const data = fs.readFileSync(cacheFilePath, 'utf8');
      const parsed: IntelligenceReport = JSON.parse(data);
      memoryCache.set(analysisHash, parsed);
      return parsed;
    }
  } catch (err) {
    // Disk read error: fallback to executing analysis
  }

  return null;
}

/**
 * Persists an intelligence report into cache
 */
export async function setCachedIntelligence(report: IntelligenceReport): Promise<void> {
  memoryCache.set(report.analysisHash, report);

  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cacheFilePath = path.join(CACHE_DIR, `${report.analysisHash}.json`);
    fs.writeFileSync(cacheFilePath, JSON.stringify(report, null, 2), 'utf8');
  } catch (err) {
    // Non-critical persistence failure
  }
}

/**
 * Invalidates cached intelligence if transcript or media modifies
 */
export async function invalidateIntelligenceCache(analysisHash: string): Promise<void> {
  memoryCache.delete(analysisHash);

  try {
    const cacheFilePath = path.join(CACHE_DIR, `${analysisHash}.json`);
    if (fs.existsSync(/*turbopackIgnore: true*/ cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
  } catch (err) {
    // Ignore unlink failure
  }
}
