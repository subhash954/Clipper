import fs from 'fs';
import { execSync } from 'child_process';
import { SubjectDetection } from './types';
import { getFfmpegPath } from '../renderEngine';
import { ClipperError } from '../errors';

export interface DetectorOptions {
  framePath: string;
  timestamp: number;
}

export interface DetectorMetadata {
  provider: string;
  providerMode: 'ml-vision' | 'heuristic' | 'fixture' | 'hybrid';
  capabilities: string[];
  degraded: boolean;
  fallbackReason?: string;
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
 * Hybrid Detector Provider
 * Tries Gemini Vision first when configured, seamlessly falling back to local centroid heuristic.
 * Accurately reports whether execution ran in degraded/heuristic mode.
 */
export class HybridDetectorProvider implements ISubjectDetectorProvider {
  readonly name = 'hybrid';
  private gemini = new GeminiVisionDetectorProvider();
  private local = new LocalCentroidDetectorProvider('Gemini unavailable or failed, fell back to local centroid');
  private activeProviderName: 'gemini-vision' | 'local-centroid' = process.env.GEMINI_API_KEY ? 'gemini-vision' : 'local-centroid';
  private fallbackReason?: string = process.env.GEMINI_API_KEY ? undefined : 'GEMINI_API_KEY not configured, using local heuristic';

  getMetadata(): DetectorMetadata {
    if (this.activeProviderName === 'gemini-vision' && !this.fallbackReason) {
      return {
        provider: 'gemini-vision',
        providerMode: 'ml-vision',
        capabilities: ['multimodal-bounding-boxes', 'face-and-person-labels'],
        degraded: false,
      };
    }

    return {
      provider: 'local-centroid',
      providerMode: 'heuristic',
      capabilities: ['spatial-luminance-centroid', 'color-contrast'],
      degraded: true,
      fallbackReason: this.fallbackReason || 'Gemini Vision unavailable, fell back to local heuristic',
    };
  }

  async detectSubjects(options: DetectorOptions): Promise<SubjectDetection[]> {
    if (process.env.GEMINI_API_KEY) {
      try {
        const results = await this.gemini.detectSubjects(options);
        if (results.length > 0) {
          this.activeProviderName = 'gemini-vision';
          this.fallbackReason = undefined;
          return results;
        }
      } catch (err: any) {
        // Fall back to local centroid on network/quota failure
        this.activeProviderName = 'local-centroid';
        this.fallbackReason = `Gemini call failed (${err.message || 'unknown error'}), fell back to local centroid`;
      }
    } else {
      this.activeProviderName = 'local-centroid';
      this.fallbackReason = 'GEMINI_API_KEY not configured, using local heuristic';
    }

    return await this.local.detectSubjects(options);
  }
}
