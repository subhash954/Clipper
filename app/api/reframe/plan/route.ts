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

function isValidFiniteNumber(val: any, min?: number, max?: number): val is number {
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (Number.isNaN(val)) return false;
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
}

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

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!CANONICAL_ASPECT_RATIOS.includes(targetAspectRatio)) {
      return NextResponse.json(
        { error: `Invalid targetAspectRatio: must be one of ${CANONICAL_ASPECT_RATIOS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!['center', 'smart', 'manual'].includes(trackingMode)) {
      return NextResponse.json({ error: 'Invalid trackingMode: must be center, smart, or manual' }, { status: 400 });
    }

    if (!['SINGLE', 'DUAL', 'GROUP', 'GENERAL'].includes(multiPersonMode)) {
      return NextResponse.json(
        { error: 'Invalid multiPersonMode: must be SINGLE, DUAL, GROUP, or GENERAL' },
        { status: 400 }
      );
    }

    if (manualSettings) {
      if (!isValidFiniteNumber(manualSettings.x, 0, 1) || !isValidFiniteNumber(manualSettings.y, 0, 1)) {
        return NextResponse.json({ error: 'Invalid manualSettings x/y coordinates: must be in range [0, 1]' }, { status: 400 });
      }
      if (!isValidFiniteNumber(manualSettings.zoom, 1.0, 2.5)) {
        return NextResponse.json({ error: 'Invalid manualSettings zoom: must be in range [1.0, 2.5]' }, { status: 400 });
      }
    }

    if (smoothingAlpha !== undefined && !isValidFiniteNumber(smoothingAlpha, 0.01, 1.0)) {
      return NextResponse.json({ error: 'Invalid smoothingAlpha: must be in range (0, 1]' }, { status: 400 });
    }

    if (deadZone !== undefined && !isValidFiniteNumber(deadZone, 0, 0.5)) {
      return NextResponse.json({ error: 'Invalid deadZone: must be in range [0, 0.5]' }, { status: 400 });
    }

    if (headroom !== undefined && !isValidFiniteNumber(headroom, 0, 1.0)) {
      return NextResponse.json({ error: 'Invalid headroom: must be in range [0, 1.0]' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'viewer');
    const storage = getStorage();

    let analysis: ReframeAnalysis | null = null;
    if (clientAnalysis && clientAnalysis.sourceWidth && clientAnalysis.sourceHeight) {
      analysis = clientAnalysis;
    } else if (storage.getReframeAnalysis) {
      analysis = await storage.getReframeAnalysis(projectId);
    }

    const sourceWidth = analysis?.sourceWidth || 1920;
    const sourceHeight = analysis?.sourceHeight || 1080;
    const duration = analysis?.duration || 30;

    const cameraPath = generateCameraPath({
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

    return NextResponse.json({
      success: true,
      cameraPath,
    });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
