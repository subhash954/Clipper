import fs from 'fs';
import { execSync } from 'child_process';
import { SubjectDetection } from './types';
import { getFfmpegPath } from '../renderEngine';
import { ClipperError } from '../errors';

export interface DetectorOptions {
  framePath: string;
  timestamp: number;
}

export interface FallbackEvent {
  timestamp?: number;
  fromProvider: string;
  toProvider: string;
  reason: string;
}

export interface DetectorMetadata {
  provider: string;
  providerMode: 'ml-vision' | 'heuristic' | 'fixture' | 'hybrid';
  capabilities: string[];
  degraded: boolean;
  fallbackReason?: string;
  providersUsed?: string[];
  fallbackEvents?: FallbackEvent[];
}

export interface ISubjectDetectorProvider {
  readonly name: string;
  getMetadata(): DetectorMetadata;
  detectSubjects(options: DetectorOptions): Promise<SubjectDetection[]>;
}

/**
 * Local Spatial Centroid & Color Contrast Detector Provider
 * Computes luminance and skin tone centroids from raw RGB frames.
 * NOTE: This is an explicit spatial HEURISTIC, not a true face/person ML detector.
 * It is marked degraded: true. Detector failures yield empty results, NEVER fake manufactured persons.
 */
export class LocalCentroidDetectorProvider implements ISubjectDetectorProvider {
  readonly name = 'local-centroid';

  constructor(private fallbackReason = 'Spatial heuristic used (ML vision unavailable)') {}

  getMetadata(): DetectorMetadata {
    return {
      provider: 'local-centroid',
      providerMode: 'heuristic',
      capabilities: ['spatial-luminance-centroid', 'color-contrast'],
      degraded: true,
      fallbackReason: this.fallbackReason,
      providersUsed: ['local-centroid'],
      fallbackEvents: [],
    };
  }

  async detectSubjects(options: DetectorOptions): Promise<SubjectDetection[]> {
    const { framePath, timestamp } = options;
    if (!fs.existsSync(framePath)) {
      // Do NOT manufacture a fake person on missing frame. Return honest empty list.
      return [];
    }

    try {
      const ffmpeg = getFfmpegPath();
      // Downscale to 64x36 raw RGB24
      const rawBuffer = execSync(
        `"${ffmpeg}" -v error -i "${framePath}" -vf "scale=64:36" -f rawvideo -pix_fmt rgb24 -`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 5000 }
      );

      const width = 64;
      const height = 36;
      let sumWeight = 0;
      let sumX = 0;
      let sumY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 3;
          const r = rawBuffer[idx];
          const g = rawBuffer[idx + 1];
          const b = rawBuffer[idx + 2];

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const isWarmTone = r > 90 && g > 40 && b > 20 && r > g && (r - g) > 15;
          const centerDistX = Math.abs(x / width - 0.5);
          const centerBias = 1.0 - centerDistX * 0.4;
          const weight = (isWarmTone ? 2.5 : 1.0) * (lum / 255) * centerBias;

          sumWeight += weight;
          sumX += x * weight;
          sumY += y * weight;
        }
      }

      if (sumWeight > 0) {
        const normX = Math.max(0.1, Math.min(0.9, (sumX / sumWeight) / width));
        const normY = Math.max(0.15, Math.min(0.85, (sumY / sumWeight) / height));

        return [
          {
            timestamp,
            x: Math.round(normX * 1000) / 1000,
            y: Math.round(normY * 1000) / 1000,
            width: 0.35,
            height: 0.5,
            confidence: 0.85,
            subjectType: 'centroid',
            subjectId: 'subject-0',
          },
        ];
      }
    } catch {
      // Detector failure: return empty detection list instead of fake fallback
      return [];
    }

    return [];
  }
}

/**
 * Gemini Vision Multimodal Subject Detector Provider
 * Detects 2D bounding boxes and speaker identities using Gemini Vision API if key configured.
 */
export class GeminiVisionDetectorProvider implements ISubjectDetectorProvider {
  readonly name = 'gemini-vision';

  constructor(private apiKey = process.env.GEMINI_API_KEY) {}

  getMetadata(): DetectorMetadata {
    return {
      provider: 'gemini-vision',
      providerMode: 'ml-vision',
      capabilities: ['multimodal-bounding-boxes', 'face-and-person-labels', 'speaker-identification'],
      degraded: false,
      providersUsed: ['gemini-vision'],
      fallbackEvents: [],
    };
  }

  async detectSubjects(options: DetectorOptions): Promise<SubjectDetection[]> {
    const { framePath, timestamp } = options;
    if (!this.apiKey || !fs.existsSync(framePath)) {
      throw new Error('Gemini API key not configured or frame file missing');
    }

    const imageBytes = fs.readFileSync(framePath);
    const base64Image = imageBytes.toString('base64');

    const prompt = `Analyze this video frame and identify all human speakers and primary visual subjects. Return a JSON array under key "subjects", where each element has:
- "box_2d": [ymin, xmin, ymax, xmax] with values 0 to 1000
- "label": "person" or "face"
- "confidence": 0.0 to 1.0
- "id": "person_1", "person_2", etc.
Respond ONLY in valid JSON. Example: {"subjects": [{"box_2d": [100, 200, 800, 600], "label": "person", "confidence": 0.95, "id": "person_1"}]}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return [];
    }

    const parsed = JSON.parse(text);
    const subjects = Array.isArray(parsed.subjects)
      ? parsed.subjects
      : parsed.box_2d
      ? [{ box_2d: parsed.box_2d, confidence: parsed.confidence, id: 'person_1', label: 'person' }]
      : [];

    const detections: SubjectDetection[] = [];

    for (const sub of subjects) {
      if (Array.isArray(sub.box_2d) && sub.box_2d.length === 4) {
        const [ymin, xmin, ymax, xmax] = sub.box_2d.map((v: number) => v / 1000);
        const centerX = (xmin + xmax) / 2;
        const centerY = (ymin + ymax) / 2;
        const width = Math.max(0.01, xmax - xmin);
        const height = Math.max(0.01, ymax - ymin);

        detections.push({
          timestamp,
          x: Math.round(Math.max(0.02, Math.min(0.98, centerX)) * 1000) / 1000,
          y: Math.round(Math.max(0.02, Math.min(0.98, centerY)) * 1000) / 1000,
          width: Math.round(width * 1000) / 1000,
          height: Math.round(height * 1000) / 1000,
          confidence: Math.min(1.0, Math.max(0.1, Number(sub.confidence) || 0.9)),
          subjectType: sub.label === 'face' ? 'face' : 'person',
          subjectId: sub.id || `person_${detections.length + 1}`,
        });
      }
    }

    return detections;
  }
}

/**
 * Fixture Subject Detector Provider
 * Strictly gated to test environments (NODE_ENV === 'test').
 * Supplies deterministic, parameterized subject detection sequences for headless testing & verification.
 */
export class FixtureDetectorProvider implements ISubjectDetectorProvider {
  readonly name = 'fixture';

  constructor(private fixtureMap: Map<number, SubjectDetection[]> = new Map()) {
    if (process.env.NODE_ENV !== 'test') {
      throw new ClipperError('FORBIDDEN', 'FixtureDetectorProvider is strictly restricted to test environment', 403);
    }
  }

  getMetadata(): DetectorMetadata {
    return {
      provider: 'fixture',
      providerMode: 'fixture',
      capabilities: ['deterministic-fixtures'],
      degraded: false,
      providersUsed: ['fixture'],
      fallbackEvents: [],
    };
  }

  setDetectionsForTimestamp(timestamp: number, detections: SubjectDetection[]) {
    this.fixtureMap.set(Math.round(timestamp * 10) / 10, detections);
  }

  async detectSubjects(options: DetectorOptions): Promise<SubjectDetection[]> {
    const key = Math.round(options.timestamp * 10) / 10;
    if (this.fixtureMap.has(key)) {
      return this.fixtureMap.get(key)!;
    }

    // Default centered fixture if timestamp not explicitly mapped
    return [
      {
        timestamp: options.timestamp,
        x: 0.5,
        y: 0.4,
        width: 0.35,
        height: 0.5,
        confidence: 0.9,
        subjectType: 'person',
        subjectId: 'fixture-subject-1',
      },
    ];
  }
}

/**
 * Deterministically sanitizes and categorizes provider failure reasons.
 * Enforces strict semantic error codes and guarantees no URLs, paths, tokens,
 * headers, response payloads, or stack traces are ever exposed or persisted.
 */
export function sanitizeProviderFailureReason(error: unknown): string {
  try {
    let rawStr = '';
    if (error instanceof Error) {
      rawStr = `${error.name} ${error.message}`;
    } else if (typeof error === 'string') {
      rawStr = error;
    } else if (error && typeof error === 'object') {
      try {
        rawStr = JSON.stringify(error);
      } catch {
        rawStr = String(error);
      }
    }

    const lower = rawStr.toLowerCase();

    // 1. Rate limiting & quota exhaustion (HTTP 429)
    if (
      lower.includes('429') ||
      lower.includes('rate limit') ||
      lower.includes('quota') ||
      lower.includes('resource_exhausted') ||
      lower.includes('too many requests')
    ) {
      return 'GEMINI_RATE_LIMITED';
    }

    // 2. Authentication & Authorization (HTTP 401, 403)
    if (
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('permission_denied') ||
      lower.includes('api key') ||
      lower.includes('apikey') ||
      lower.includes('api_key') ||
      lower.includes('key=') ||
      lower.includes('bearer') ||
      lower.includes('auth') ||
      lower.includes('credential')
    ) {
      return 'GEMINI_AUTH_FAILURE';
    }

    // 3. Timeouts (HTTP 408, deadline exceeded)
    if (
      lower.includes('408') ||
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('deadline_exceeded') ||
      lower.includes('etimedout')
    ) {
      return 'GEMINI_TIMEOUT';
    }

    // 4. Provider server errors (5xx, service unavailable, bad gateway)
    if (
      lower.includes('500') ||
      lower.includes('502') ||
      lower.includes('503') ||
      lower.includes('504') ||
      lower.includes('internal server error') ||
      lower.includes('service unavailable') ||
      lower.includes('bad gateway') ||
      lower.includes('gateway timeout')
    ) {
      return 'GEMINI_PROVIDER_UNAVAILABLE';
    }

    // 5. Network / Transport connectivity failures
    if (
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('econnreset') ||
      lower.includes('fetch failed') ||
      lower.includes('network') ||
      lower.includes('dns') ||
      lower.includes('socket hang up')
    ) {
      return 'GEMINI_NETWORK_FAILURE';
    }

    // 6. Response parsing / Invalid JSON payload
    if (
      lower.includes('invalid json') ||
      lower.includes('unexpected token') ||
      lower.includes('json parse') ||
      lower.includes('syntaxerror')
    ) {
      return 'GEMINI_INVALID_RESPONSE';
    }

    // 7. Generic / default fallback
    return 'GEMINI_REQUEST_FAILED';
  } catch {
    return 'GEMINI_REQUEST_FAILED';
  }
}

export type ActiveDetectorProvider = 'gemini-vision' | 'local-centroid';

/**
 * Hybrid Detector Provider
 * Tries Gemini Vision first when configured, permanently falling back to local centroid heuristic
 * upon the first Gemini failure within an analysis lifecycle.
 * Accurately reports every provider used during the analysis and all fallback transitions.
 */
export class HybridDetectorProvider implements ISubjectDetectorProvider {
  readonly name = 'hybrid';
  private gemini: ISubjectDetectorProvider;
  private local: ISubjectDetectorProvider;
  private activeProvider: ActiveDetectorProvider;
  private degraded: boolean = false;
  private providersUsed: string[] = [];
  private fallbackEvents: FallbackEvent[] = [];
  private fallbackReason?: string;

  constructor(gemini?: ISubjectDetectorProvider, local?: ISubjectDetectorProvider) {
    this.gemini = gemini || new GeminiVisionDetectorProvider();
    this.local = local || new LocalCentroidDetectorProvider('Gemini unavailable or failed, fell back to local centroid');

    const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY) || (gemini !== undefined && !(gemini instanceof GeminiVisionDetectorProvider));

    if (isGeminiConfigured) {
      this.activeProvider = 'gemini-vision';
      this.degraded = false;
    } else {
      this.activeProvider = 'local-centroid';
      this.degraded = true;
      this.fallbackReason = 'GEMINI_UNAVAILABLE';
      this.addProviderUsed('local-centroid');
    }
  }

  private addProviderUsed(name: string) {
    if (!this.providersUsed.includes(name)) {
      this.providersUsed.push(name);
    }
  }

  getMetadata(): DetectorMetadata {
    const providers = this.providersUsed.length > 0
      ? [...this.providersUsed]
      : (this.activeProvider === 'gemini-vision' ? ['gemini-vision'] : ['local-centroid']);

    const usesLocal = providers.includes('local-centroid');
    const usesGemini = providers.includes('gemini-vision');

    if (usesGemini && usesLocal) {
      return {
        provider: 'hybrid',
        providerMode: 'hybrid',
        capabilities: ['multimodal-bounding-boxes', 'spatial-luminance-centroid', 'color-contrast'],
        degraded: true,
        fallbackReason: this.fallbackReason || 'Gemini Vision partially failed, fell back to local heuristic',
        providersUsed: providers,
        fallbackEvents: [...this.fallbackEvents],
      };
    }

    if (usesGemini && !this.degraded && this.fallbackEvents.length === 0) {
      return {
        provider: 'gemini-vision',
        providerMode: 'ml-vision',
        capabilities: ['multimodal-bounding-boxes', 'face-and-person-labels'],
        degraded: false,
        providersUsed: providers,
        fallbackEvents: [],
      };
    }

    return {
      provider: 'local-centroid',
      providerMode: 'heuristic',
      capabilities: ['spatial-luminance-centroid', 'color-contrast'],
      degraded: true,
      fallbackReason: this.fallbackReason || 'Gemini Vision unavailable, fell back to local heuristic',
      providersUsed: providers,
      fallbackEvents: [...this.fallbackEvents],
    };
  }

  async detectSubjects(options: DetectorOptions): Promise<SubjectDetection[]> {
    // If activeProvider has permanently transitioned to local-centroid, invoke local directly without retrying Gemini
    if (this.activeProvider === 'local-centroid') {
      this.addProviderUsed('local-centroid');
      return await this.local.detectSubjects(options);
    }

    // Active provider is gemini-vision
    try {
      const results = await this.gemini.detectSubjects(options);
      // Successful call from Gemini: record provider and return results (even if empty [])
      this.addProviderUsed('gemini-vision');
      return results;
    } catch (err: unknown) {
      // Gemini failed: permanently transition to local-centroid for the remainder of this analysis
      const sanitizedReason = sanitizeProviderFailureReason(err);
      this.activeProvider = 'local-centroid';
      this.degraded = true;
      this.fallbackReason = `Gemini call failed (${sanitizedReason}), fell back to local centroid`;

      // Record exactly ONE fallback transition event
      this.fallbackEvents.push({
        timestamp: options.timestamp,
        fromProvider: 'gemini-vision',
        toProvider: 'local-centroid',
        reason: sanitizedReason,
      });

      this.addProviderUsed('local-centroid');
      return await this.local.detectSubjects(options);
    }
  }
}
