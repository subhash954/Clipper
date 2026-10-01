import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { probeMedia, validateMediaFileSignature } from '@/lib/media/probeService';
import { MediaAsset } from '@/lib/types';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB limit

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file was uploaded.' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum upload size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const assetId = crypto.randomUUID();
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(sanitizedOriginalName) || '.mp4';
    const diskFileName = `${assetId}${ext}`;
    const destinationPath = path.join(uploadDir, diskFileName);

    // Write file to disk
    fs.writeFileSync(destinationPath, buffer);

    // 1. File signature check
    const sig = validateMediaFileSignature(destinationPath);
    if (!sig.isValid) {
      fs.unlinkSync(destinationPath);
      return NextResponse.json(
        { error: 'Invalid file signature. File must be a valid MP4, QuickTime MOV, or WebM video.' },
        { status: 400 }
      );
    }

    // 2. FFprobe deep inspection
    const probe = await probeMedia(destinationPath);
    if (!probe.isValid || !probe.hasVideo) {
      fs.unlinkSync(destinationPath);
      return NextResponse.json(
        { error: probe.error || 'Video probe failed. Media appears corrupt or unreadable.' },
        { status: 400 }
      );
    }

    const fileUrl = `/uploads/${diskFileName}`;

    const mediaAsset: MediaAsset = {
      id: assetId,
      userId: user.id,
      fileName: file.name,
      fileUrl,
      storagePath: destinationPath,
      mimeType: file.type || 'video/mp4',
      sizeBytes: file.size,
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      codec: probe.codec,
      audioCodec: probe.audioCodec,
      fps: probe.fps,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      mediaAsset,
      probe,
    });
  } catch (error: any) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process media upload.' },
      { status: 500 }
    );
  }
}
