import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoMultimodal } from '@/lib/intelligence/orchestrator';
import { mineOpportunitiesFromIntelligence, buildContentMap } from '@/lib/factory/contentMining';
import { saveOpportunities } from '@/lib/factory/contentStore';
import { sampleTranscriptWords } from '@/lib/sampleData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, sourceDurationSeconds = 30, videoUrl, words } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const transcriptWords = (words && words.length > 0) ? words : sampleTranscriptWords;

    // 1. Run / load multimodal intelligence
    const intelligenceReport = await analyzeVideoMultimodal({
      projectId,
      videoTitle: 'Source Video',
      durationSeconds: sourceDurationSeconds,
      words: transcriptWords,
      skipCache: true,
    });

    // 2. Mine distinct content opportunities
    const { opportunities, rawScannedCount, deduplicatedCount } = mineOpportunitiesFromIntelligence(
      intelligenceReport,
      transcriptWords,
      {
        projectId,
        sourceDurationSeconds,
      }
    );

    // 3. Build hierarchical Content Map
    const contentMap = buildContentMap(projectId, sourceDurationSeconds, opportunities);

    // 4. Save to content store
    await saveOpportunities(opportunities);

    return NextResponse.json({
      success: true,
      contentMap,
      opportunities,
      stats: {
        rawScannedCount,
        deduplicatedCount,
        finalOpportunitiesCount: opportunities.length,
      },
    });
  } catch (err: any) {
    console.error('Content analysis error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
