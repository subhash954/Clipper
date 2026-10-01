import { NextRequest, NextResponse } from 'next/server';
import { searchStockMedia } from '@/lib/providers/stockMediaProvider';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || 'business growth';
    const orientation = (searchParams.get('orientation') as 'portrait' | 'landscape') || 'portrait';
    const perPage = Math.min(20, Math.max(1, parseInt(searchParams.get('perPage') || '4', 10)));

    const assets = await searchStockMedia({
      query,
      orientation,
      perPage,
    });

    return NextResponse.json({
      success: true,
      query,
      orientation,
      count: assets.length,
      assets,
      videos: assets.map((a) => ({
        id: a.assetId,
        url: a.downloadUrl,
        previewImage: a.previewUrl,
        provider: a.provider,
        licenseUrl: a.licenseUrl,
      })),
    });
  } catch (error: any) {
    console.error('B-roll search API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to search stock media.',
      },
      { status: 500 }
    );
  }
}
