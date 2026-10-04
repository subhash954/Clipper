import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { extractVideoMetadata, sampleFrames } from '@/lib/reframe/reframeEngine';
import { HybridDetectorProvider } from '@/lib/reframe/detectorProvider';
import { buildSubjectTracks } from '@/lib/reframe/trackingEngine';
import { detectVideoScenes } from '@/lib/intelligence/engines/sceneEngine';
import { ReframeAnalysis, SceneBoundary, SubjectDetection } from '@/lib/reframe/types';

function isValidFiniteNumber(val: any, min?: number, max?: number): val is number {
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (Number.isNaN(val)) return false;
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const mediaAssetId = searchParams.get('mediaAssetId') || undefined;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId parameter' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'viewer');
    const storage = getStorage();
    const analysis = storage.getReframeAnalysis
      ? await storage.getReframeAnalysis(projectId, mediaAssetId)
      : null;

    if (!analysis) {
      return NextResponse.json({ error: 'No reframe analysis found for project' }, { status: 404 });
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { projectId, mediaAssetId, videoPath } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!mediaAssetId || typeof mediaAssetId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid mediaAssetId' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'editor');
    const storage = getStorage();

    // Verify project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }

    // Resolve physical video path
    let resolvedVideoPath: string | null = null;

    if (videoPath && typeof videoPath === 'string' && fs.existsSync(videoPath)) {
      resolvedVideoPath = videoPath;
    } else {
      // Check candidate media files
      const candidatePublic = path.join(process.cwd(), 'public', 'sample.mp4');
      const candidateUploads = path.join(process.cwd(), 'data', 'uploads', `${mediaAssetId}.mp4`);
      if (fs.existsSync(candidateUploads)) {
        resolvedVideoPath = candidateUploads;
      } else if (fs.existsSync(candidatePublic)) {
        resolvedVideoPath = candidatePublic;
      }
    }

    if (!resolvedVideoPath || !fs.existsSync(/*turbopackIgnore: true*/ resolvedVideoPath)) {
      throw new ClipperError(
        'MEDIA_UNAVAILABLE',
        `Video source file for media ${mediaAssetId} is not available on disk for frame extraction`,
        422
      );
    }

    // Extract real video metadata
    const meta = extractVideoMetadata(resolvedVideoPath);
    if (!isValidFiniteNumber(meta.width, 1) || !isValidFiniteNumber(meta.height, 1) || !isValidFiniteNumber(meta.duration, 0.1)) {
      throw new ClipperError('MEDIA_INVALID', 'Failed to probe valid video dimensions and duration', 400);
    }

    // Run scene detection
    let detectedScenes: SceneBoundary[] = [];
    try {
      const scenesRaw = await detectVideoScenes({
        filePath: resolvedVideoPath,
        projectId,
        totalDurationSeconds: meta.duration,
      });
      detectedScenes = scenesRaw.map((s, idx) => ({
        sceneIndex: idx,
        start: s.start,
        end: s.end,
        cutConfidence: s.cutIntensityScore,
      }));
    } catch {
      detectedScenes = [{ sceneIndex: 0, start: 0, end: meta.duration, cutConfidence: 1.0 }];
    }

    if (detectedScenes.length === 0) {
      detectedScenes = [{ sceneIndex: 0, start: 0, end: meta.duration, cutConfidence: 1.0 }];
    }

    // Sample video frames and detect subjects
    const detector = new HybridDetectorProvider();
    const samples = await sampleFrames(resolvedVideoPath, 0, meta.duration, 1);
    const detectionFrames: SubjectDetection[][] = [];

    for (const sample of samples) {
      try {
        const frameDets = await detector.detectSubjects({
          framePath: sample.framePath,
          timestamp: sample.time,
        });
        detectionFrames.push(frameDets);
      } catch {
        detectionFrames.push([
          {
            timestamp: sample.time,
            x: 0.5,
            y: 0.4,
            width: 0.35,
            height: 0.5,
            confidence: 0.5,
            subjectType: 'fallback',
          },
        ]);
      }
    }

    // Clean up sample frames
    try {
      if (samples.length > 0) {
        const frameDir = path.dirname(samples[0].framePath);
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
    } catch {}

    // Assemble deterministic subject tracks respecting scene cuts
    const subjectTracks = buildSubjectTracks(detectionFrames, detectedScenes);

    const analysis: ReframeAnalysis = {
      id: crypto.randomUUID(),
      projectId,
      mediaAssetId,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      duration: meta.duration,
      scenes: detectedScenes,
      subjectTracks,
      provider: detector.name,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    if (storage.saveReframeAnalysis) {
      await storage.saveReframeAnalysis(analysis, user.id);
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
