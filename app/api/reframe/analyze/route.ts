import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { extractVideoMetadata, sampleFrames } from '@/lib/reframe/reframeEngine';
import { HybridDetectorProvider } from '@/lib/reframe/detectorProvider';
import { resolveAuthorizedMediaSource } from '@/lib/reframe/mediaResolver';
import { isFiniteNumber, isPositiveInteger, validateReframeAnalysis } from '@/lib/reframe/validation';
import { buildSubjectTracks } from '@/lib/reframe/trackingEngine';
import { detectVideoScenes } from '@/lib/intelligence/engines/sceneEngine';
import { ReframeAnalysis, SceneBoundary, SubjectDetection } from '@/lib/reframe/types';

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

    // TRUST BOUNDARY GATE: Strictly forbid client-supplied videoPath
    if (body.videoPath !== undefined) {
      return NextResponse.json(
        { error: 'Client-supplied videoPath is forbidden: provide projectId and mediaAssetId for authoritative resolution' },
        { status: 400 }
      );
    }

    const { projectId, mediaAssetId } = body;

    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!mediaAssetId || typeof mediaAssetId !== 'string' || !mediaAssetId.trim()) {
      return NextResponse.json({ error: 'Missing or invalid mediaAssetId' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'editor');

    // Authoritative media resolution: checks project access, media existence,
    // cross-project media ownership, and filesystem safety (symlink / traversal guards)
    const resolved = await resolveAuthorizedMediaSource({
      projectId,
      mediaAssetId,
      userId: user.id,
      requireEditorAccess: true,
    });

    const resolvedVideoPath = resolved.localPath;

    // Extract real video metadata with DoS boundary enforcement
    const meta = extractVideoMetadata(resolvedVideoPath);
    if (
      !isPositiveInteger(meta.width, 1) ||
      !isPositiveInteger(meta.height, 1) ||
      !isFiniteNumber(meta.duration, 0.1)
    ) {
      throw new ClipperError('MEDIA_INVALID', 'Failed to probe valid video dimensions and duration', 400);
    }

    if (meta.width > 7680 || meta.height > 4320) {
      throw new ClipperError('MEDIA_INVALID', `Video resolution (${meta.width}x${meta.height}) exceeds maximum supported 8K`, 400);
    }

    if (meta.duration > 7200) {
      throw new ClipperError('MEDIA_INVALID', `Video duration (${meta.duration}s) exceeds maximum allowed 2 hours`, 400);
    }


    // Run scene detection with honest degradation telemetry
    let detectedScenes: SceneBoundary[] = [];
    let sceneDetectionDegraded = false;
    let sceneDetectionReason: string | undefined;

    try {
      const scenesRaw = await detectVideoScenes({
        filePath: resolvedVideoPath,
        projectId,
        totalDurationSeconds: meta.duration,
      });

      if (Array.isArray(scenesRaw) && scenesRaw.length > 0) {
        detectedScenes = scenesRaw.map((s, idx) => ({
          sceneIndex: idx,
          start: s.start,
          end: s.end,
          cutConfidence: s.cutIntensityScore,
        }));
      } else {
        sceneDetectionDegraded = true;
        sceneDetectionReason = 'Scene detector produced 0 cuts; fell back to single scene';
        detectedScenes = [{ sceneIndex: 0, start: 0, end: meta.duration, cutConfidence: 0.0 }];
      }
    } catch (sceneErr: any) {
      sceneDetectionDegraded = true;
      sceneDetectionReason = `Scene detection failed (${sceneErr.message || 'unknown'}); fell back to single scene`;
      detectedScenes = [{ sceneIndex: 0, start: 0, end: meta.duration, cutConfidence: 0.0 }];
    }

    // Sample video frames and detect subjects with GUARANTEED cleanup
    const detector = new HybridDetectorProvider();
    const samples = await sampleFrames(resolvedVideoPath, 0, meta.duration, 1);
    const detectionFrames: SubjectDetection[][] = [];

    try {
      for (const sample of samples) {
        try {
          const frameDets = await detector.detectSubjects({
            framePath: sample.framePath,
            timestamp: sample.time,
          });
          detectionFrames.push(frameDets);
        } catch {
          // Failure policy: record empty list, NEVER manufacture a fake person
          detectionFrames.push([]);
        }
      }
    } finally {
      // Guaranteed temporary frame cleanup under all outcomes
      samples.cleanup();
      if (resolved.cleanup) {
        await resolved.cleanup();
      }
    }

    // Assemble deterministic subject tracks respecting scene cuts
    const subjectTracks = buildSubjectTracks(detectionFrames, detectedScenes);

    const detectorMeta = detector.getMetadata();
    const isDegraded = detectorMeta.degraded || sceneDetectionDegraded;

    const rawAnalysis: ReframeAnalysis = {
      id: crypto.randomUUID(),
      projectId,
      mediaAssetId,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      duration: meta.duration,
      scenes: detectedScenes,
      subjectTracks,
      provider: detectorMeta.provider,
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      degraded: isDegraded,
      metadata: {
        engineVersion: '2.0.0',
        analysisSchemaVersion: '1.1.0',
        detectorProvider: detectorMeta.provider,
        detectorMode: detectorMeta.providerMode,
        capabilities: detectorMeta.capabilities,
        degraded: isDegraded,
        fallbackReason: detectorMeta.fallbackReason,
        providersUsed: detectorMeta.providersUsed || [detectorMeta.provider],
        fallbackEvents: detectorMeta.fallbackEvents || [],
        sceneDetection: {
          status: sceneDetectionDegraded ? 'degraded' : 'normal',
          reason: sceneDetectionReason,
          fallback: sceneDetectionDegraded ? 'single_scene' : undefined,
        },
      },
    };

    const analysis = validateReframeAnalysis(rawAnalysis);

    const storage = getStorage();
    if (storage.saveReframeAnalysis) {
      await storage.saveReframeAnalysis(analysis, user.id);
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
