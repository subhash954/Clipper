import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { generateCameraPath } from '@/lib/reframe/cameraPathPlanner';
import {
  AspectRatio,
  MultiPersonMode,
  TrackingMode,
  CANONICAL_ASPECT_RATIOS,
  ReframeAnalysis,
} from '@/lib/reframe/types';
import {
  validateReframeConfig,
  validateReframeAnalysis,
  validateCameraPath,
} from '@/lib/reframe/validation';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const {
      projectId,
      targetAspectRatio = '9:16',
      trackingMode = 'smart',
      multiPersonMode = 'GENERAL',
      manualSettings,
      smoothingAlpha,
      deadZone,
      headroom,
      analysis: clientAnalysis,
    } = body;

    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    // Strict runtime configuration validation
    validateReframeConfig({
      targetAspectRatio,
      trackingMode,
      multiPersonMode,
      manualSettings,
      smoothingAlpha,
      deadZone,
      headroom,
    });

    await requireProjectAccess(user, projectId, 'viewer');
    const storage = getStorage();

    let analysis: ReframeAnalysis | null = null;

    if (clientAnalysis) {
      // Validate preview analysis strictly
      analysis = validateReframeAnalysis(clientAnalysis);
    } else if (storage.getReframeAnalysis) {
      analysis = await storage.getReframeAnalysis(projectId);
    }

    const sourceWidth = analysis?.sourceWidth || 1920;
    const sourceHeight = analysis?.sourceHeight || 1080;
    const duration = analysis?.duration || 30;

    const rawCameraPath = generateCameraPath({
      sourceWidth,
      sourceHeight,
      duration,
      scenes: analysis?.scenes,
      subjectTracks: analysis?.subjectTracks,
      config: {
        targetAspectRatio: targetAspectRatio as AspectRatio,
        trackingMode: trackingMode as TrackingMode,
        multiPersonMode: multiPersonMode as MultiPersonMode,
        manualSettings,
        smoothingAlpha,
        deadZone,
        headroom,
      },
    });

    // Validate the generated camera path output
    const cameraPath = validateCameraPath(rawCameraPath, duration);

    return NextResponse.json({
      success: true,
      cameraPath,
    });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
