/**
 * CLIPPER ENVIRONMENT & CONFIGURATION VALIDATOR
 * Step 15: Production-grade validation of runtime configuration and secrets.
 */

import { ClipperError } from '../errors';

export interface EnvValidationReport {
  isValid: boolean;
  environment: string;
  storageMode: string;
  configuredServices: {
    supabase: boolean;
    gemini: boolean;
    deepgram: boolean;
    ffmpeg: boolean;
  };
  diagnostics: Record<string, string>;
  errors: string[];
}

export function validateEnvironment(): EnvValidationReport {
  const env = process.env.NODE_ENV || 'development';
  const storageMode = process.env.STORAGE_MODE || (process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'local');
  const errors: string[] = [];

  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const isSupabaseConfigured = hasSupabaseUrl && hasSupabaseKey;

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasDeepgram = !!process.env.DEEPGRAM_API_KEY;
  const hasFfmpeg = !!process.env.FFMPEG_PATH || true; // @ffmpeg-installer is bundled

  // Rule 1: Production requires persistent database storage unless explicitly bypassed
  if (env === 'production') {
    if (storageMode === 'local' && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true') {
      errors.push('CRITICAL: STORAGE_MODE cannot be local in production without ALLOW_DEV_LOCAL_STORAGE=true.');
    }
    if (!isSupabaseConfigured && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true') {
      errors.push('CRITICAL: Supabase PostgreSQL credentials (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are required in production.');
    }
  }

  // Rule 2: Explicit STORAGE_MODE=supabase requires Supabase credentials in any environment
  if (storageMode === 'supabase' && !isSupabaseConfigured) {
    errors.push('CRITICAL: STORAGE_MODE is set to supabase but NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  const diagnostics: Record<string, string> = {
    NODE_ENV: env,
    STORAGE_MODE: storageMode,
    NEXT_PUBLIC_SUPABASE_URL: hasSupabaseUrl ? '[CONFIGURED]' : '[MISSING]',
    SUPABASE_SERVICE_ROLE_KEY: hasSupabaseKey ? '[REDACTED: PRESENT]' : '[MISSING]',
    GEMINI_API_KEY: hasGemini ? '[REDACTED: PRESENT]' : '[NOT CONFIGURED (FALLBACK MODE)]',
    DEEPGRAM_API_KEY: hasDeepgram ? '[REDACTED: PRESENT]' : '[NOT CONFIGURED (FALLBACK MODE)]',
  };

  const isValid = errors.length === 0;

  return {
    isValid,
    environment: env,
    storageMode,
    configuredServices: {
      supabase: isSupabaseConfigured,
      gemini: hasGemini,
      deepgram: hasDeepgram,
      ffmpeg: hasFfmpeg,
    },
    diagnostics,
    errors,
  };
}

export function assertValidEnvironment(): void {
  const report = validateEnvironment();
  if (!report.isValid) {
    throw new ClipperError(
      'CONFIGURATION_ERROR',
      `Environment configuration failed: ${report.errors.join('; ')}`,
      500,
      false,
      { diagnostics: report.diagnostics }
    );
  }
}
