import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || 'business';
    const clientPexelsKey = req.headers.get('x-pexels-key');
    const clientPixabayKey = req.headers.get('x-pixabay-key');

    const pexelsKey = clientPexelsKey || process.env.PEXELS_API_KEY;
    const pixabayKey = clientPixabayKey || process.env.PIXABAY_API_KEY;

    // 1. Try Pexels first (Best for vertical 9:16 portrait video)
    if (pexelsKey) {
      try {
        const response = await fetch(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=4`,
          {
            headers: { Authorization: pexelsKey }
          }
        );
        const data = await response.json();
        if (data.videos && data.videos.length > 0) {
          return NextResponse.json({
            provider: 'pexels',
            isLiveBroll: true,
            videos: data.videos.map((v: { id: number; video_files: Array<{ link: string; width: number; height: number }>; image: string }) => ({
              id: v.id,
              url: v.video_files?.[0]?.link || '',
              previewImage: v.image
            }))
          });
        }
      } catch (err) {
        console.warn("Pexels fetch failed, falling back to Pixabay:", err);
      }
    }

    // 2. Try Pixabay (Fallback or secondary provider)
    if (pixabayKey) {
      try {
        const response = await fetch(
          `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=4`
        );
        const data = await response.json();
        if (data.hits && data.hits.length > 0) {
          return NextResponse.json({
            provider: 'pixabay',
            isLiveBroll: true,
            videos: data.hits.map((h: { id: number; videos: { medium: { url: string; thumbnail: string } } }) => ({
              id: h.id,
              url: h.videos?.medium?.url || '',
              previewImage: h.videos?.medium?.thumbnail || ''
            }))
          });
        }
      } catch (err) {
        console.warn("Pixabay fetch failed:", err);
      }
    }

    // 3. Fallback to curated high-converting sample clips
    return NextResponse.json({
      provider: 'curated_library',
      isLiveBroll: false,
      message: "No live Pexels or Pixabay key active. Using curated royalty-free clips.",
      videos: [
        {
          id: 1,
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          previewImage: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg"
        }
      ]
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ isLiveBroll: false, error: message }, { status: 500 });
  }
}
