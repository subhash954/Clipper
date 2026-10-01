import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { WordTimestamp, Transcript, Project, ViralClip } from '@/lib/types';
import { analyzeTranscriptWithGemini } from '@/lib/providers/geminiProvider';
import { alignClipsToTranscript } from '@/lib/alignmentEngine';
import { getStorage } from '@/lib/storage';

/**
 * Robustly parses YouTube URLs across all standard formats:
 * - https://www.youtube.com/watch?v=...
 * - https://youtu.be/...
 * - https://www.youtube.com/shorts/...
 * - https://www.youtube.com/embed/...
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtubeUrl, clipCount = 5 } = body;

    // 1. Strict URL validation
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return NextResponse.json(
        { error: 'A valid YouTube URL is required.' },
        { status: 400 }
      );
    }

    const videoId = extractYouTubeVideoId(youtubeUrl.trim());
    if (!videoId) {
      return NextResponse.json(
        {
          error:
            'Invalid YouTube URL. Please provide a standard YouTube video link (watch?v=..., youtu.be/..., or /shorts/...).',
        },
        { status: 400 }
      );
    }

    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // 2. Retrieve real metadata via YouTube oEmbed API
    let videoTitle = 'YouTube Video';
    let authorName = 'YouTube Creator';
    let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`
      );
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        videoTitle = oembedData.title || videoTitle;
        authorName = oembedData.author_name || authorName;
        thumbnailUrl = oembedData.thumbnail_url || thumbnailUrl;
      }
    } catch (e) {
      console.warn('oEmbed metadata fetch warning:', e);
    }

    // 3. Fetch authentic transcript from YouTube caption tracks
    let transcriptText = '';
    let wordTimestamps: WordTimestamp[] = [];
    let isLiveCaptions = false;

    try {
      const rawCues = await YoutubeTranscript.fetchTranscript(videoId);
      if (Array.isArray(rawCues) && rawCues.length > 0) {
        isLiveCaptions = true;
        const textParts: string[] = [];

        rawCues.forEach((cue: any) => {
          const cueText = (cue.text || '')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .trim();

          if (!cueText) return;
          textParts.push(cueText);

          const cueStartSec = parseFloat((Number(cue.offset || 0) / 1000).toFixed(2));
          const cueDurationSec = parseFloat((Number(cue.duration || 0) / 1000).toFixed(2));
          const cueWords = cueText.split(/\s+/).filter(Boolean);

          if (cueWords.length > 0) {
            const wordDuration = cueDurationSec / cueWords.length;
            cueWords.forEach((word: string, wIdx: number) => {
              const start = parseFloat((cueStartSec + wIdx * wordDuration).toFixed(2));
              const end = parseFloat((cueStartSec + (wIdx + 1) * wordDuration).toFixed(2));
              wordTimestamps.push({
                word,
                start,
                end,
                confidence: 0.95,
              });
            });
          }
        });

        transcriptText = textParts.join(' ');
      }
    } catch (transcriptError: any) {
      console.warn('YouTube caption fetch error:', transcriptError?.message);
    }

    // If transcript is unavailable on YouTube, reject cleanly with actionable instructions
    if (!isLiveCaptions || wordTimestamps.length === 0) {
      return NextResponse.json(
        {
          error:
            'Captions are disabled or unavailable for this video on YouTube. To process videos without public captions, please use the direct file upload option.',
          videoId,
          videoTitle,
          authorName,
          thumbnailUrl,
        },
        { status: 422 }
      );
    }

    const transcript: Transcript = {
      text: transcriptText,
      words: wordTimestamps,
      source: 'youtube_captions',
      timingPrecision: 'approximate_cue',
      timingLabel: 'YouTube Caption Cues (Approximate Timing)',
      language: 'en',
    };

    // 4. Run Gemini 2.5 Flash on the authentic transcript
    const targetCount = Math.min(10, Math.max(3, Number(clipCount) || 5));
    const candidateMoments = await analyzeTranscriptWithGemini({
      videoTitle,
      channelName: authorName,
      transcriptText,
      targetClipCount: targetCount,
    });

    // 5. Align candidate moments against authentic transcript word timestamps
    const lastWord = wordTimestamps[wordTimestamps.length - 1];
    const totalDurationSeconds = lastWord ? lastWord.end : 3600;

    const generatedClips: ViralClip[] = alignClipsToTranscript({
      candidates: candidateMoments,
      transcript,
      totalDurationSeconds,
    });

    // Attach video source URL and thumbnail to each clip
    generatedClips.forEach((c) => {
      c.videoUrl = cleanUrl;
      c.thumbnailUrl = thumbnailUrl;
    });

    // 6. Calculate transparent unit economics based on real usage
    const durationMinutes = parseFloat((totalDurationSeconds / 60).toFixed(1));
    const deepgramSTTCost = 0.0; // Captions sourced from caption track
    const geminiFlashLLMCost = parseFloat(((transcriptText.length / 4 / 1000000) * 0.075).toFixed(4));
    const stockBRollCost = 0.0;
    const fluxImageGenCost = parseFloat((generatedClips.length * 0.003).toFixed(3));
    const ffmpegRenderCost = parseFloat((generatedClips.length * 0.028).toFixed(3));
    const r2StorageCost = 0.015;
    const totalCostUSD = parseFloat(
      (deepgramSTTCost + geminiFlashLLMCost + stockBRollCost + fluxImageGenCost + ffmpegRenderCost + r2StorageCost).toFixed(2)
    );
    const totalCostINR = Math.round(totalCostUSD * 86.5);

    // 7. Assemble Project entity
    const project: Project = {
      id: `proj-${videoId}`,
      title: videoTitle,
      channelName: authorName,
      thumbnailUrl,
      sourceUrl: cleanUrl,
      sourceType: 'youtube',
      workflowType: 'youtube_to_shorts',
      durationSeconds: totalDurationSeconds,
      status: 'clips_ready',
      isMediaAvailable: false, // YouTube ingestion retrieves captions; video file upload required for FFmpeg rendering
      media: {
        sourceUrl: cleanUrl,
        sourceType: 'youtube',
        sourceMetadata: {
          title: videoTitle,
          duration: totalDurationSeconds,
          author: authorName,
          thumbnail: thumbnailUrl,
        },
        isMediaAvailable: false,
      },
      clipsCount: generatedClips.length,
      clips: generatedClips,
      transcript,
      costs: {
        deepgramSTTCost,
        geminiFlashLLMCost,
        stockBRollCost,
        fluxImageGenCost,
        ffmpegRenderCost,
        r2StorageCost,
        totalCostUSD,
        totalCostINR,
      },
      createdAt: new Date().toISOString(),
    };

    // 8. Persist to storage layer
    const storage = getStorage();
    await storage.saveProject(project);

    // Record cost telemetry with honest isEstimated flag
    await storage.recordCostTelemetry({
      projectId: project.id,
      serviceName: 'gemini_flash',
      model: 'gemini-2.5-flash',
      unitsUsed: Math.round(transcriptText.length / 4),
      unitType: 'tokens',
      costInUSD: geminiFlashLLMCost,
      isEstimated: true, // Character heuristic used, marked explicitly as estimated
    });

    return NextResponse.json({
      success: true,
      ...project,
      videoTitle,
      channelName: authorName,
      thumbnailUrl,
      durationMinutes,
    });
  } catch (error: any) {
    console.error('YouTube ingestion error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to ingest and process YouTube video.' },
      { status: 500 }
    );
  }
}
