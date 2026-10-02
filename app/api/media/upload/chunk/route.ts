import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getStorageService } from '@/lib/storage/storageService';
import { formatErrorResponse, ClipperError } from '@/lib/errors';

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || req.headers.get('x-upload-session-id');
    const partNumberStr = searchParams.get('partNumber') || req.headers.get('x-upload-part-number');

    if (!sessionId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'sessionId parameter is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    const partNumber = parseInt(partNumberStr || '1', 10);
    if (isNaN(partNumber) || partNumber < 1) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'Valid partNumber (>= 1) is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'Chunk payload cannot be zero bytes.', 400).toResponse(),
        { status: 400 }
      );
    }

    const storageService = getStorageService();
    const receipt = await storageService.uploadMultipartPart(
      sessionId,
      partNumber,
      Buffer.from(arrayBuffer)
    );

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
