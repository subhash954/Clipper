import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateReframeTrack } from '@/lib/reframe/reframeEngine';
import { AspectRatio, TrackingMode, ManualReframeSettings } from '@/lib/reframe/types';

/**
 * Resolves a local video file path from candidate strings
 */
function resolveLocalVideoFile(candidateUrlOrPath?: string | null): string | null {
  if (!candidateUrlOrPath) return null;
  const clean = candidateUrlOrPath.trim();

  // If direct existing file path
  if (fs.existsSync(clean)) {
    return clean;
  }

  // If relative path from public/
  const publicCandidate = path.join(process.cwd(), 'public', clean.replace(/^\//, ''));
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }

  // If path inside data/
  const dataCandidate = path.join(process.cwd(), 'data', clean.replace(/^(\/)?(data\/)?/, ''));
  if (fs.existsSync(dataCandidate)) {
    return dataCandidate;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      videoPath,
      videoUrl,
      sourceUrl,
      startTime = 0,
      duration = 30,
      aspectRatio = '9:16',
      trackingMode = 'center',
      manualSettings = { x: 0.5, y: 0.5, zoom: 1.0 },
      locked = false,
    } = body;

    const candidateMedia = videoPath || videoUrl || sourceUrl;
    const localFile = resolveLocalVideoFile(candidateMedia);

    // If trackingMode is 'center' or 'manual', we can construct the track even without physical frame sampling
    // But for 'smart', we need the real video file to detect subjects
    if (!localFile && trackingMode === 'smart') {
      return NextResponse.json(
        {
          error:
            'Source video file is not available locally for subject tracking. Please ensure video media is uploaded or provide a local video file.',
          requiresMediaUpload: true,
        },
        { status: 422 }
      );
    }

    const resolvedPath = localFile || path.join(process.cwd(), 'public', 'sample.mp4');

    const track = await generateReframeTrack({
      videoPath: resolvedPath,
      startTime: Math.max(0, parseFloat(startTime) || 0),
      duration: Math.max(0.5, parseFloat(duration) || 30),
      aspectRatio: aspectRatio as AspectRatio,
      trackingMode: trackingMode as TrackingMode,
      manualSettings: manualSettings as ManualReframeSettings,
      locked: Boolean(locked),
    });

    return NextResponse.json({
      success: true,
      track,
    });
  } catch (error: any) {
    console.error('Error in /api/reframe/track:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate reframe track' },
      { status: 500 }
    );
  }
}
