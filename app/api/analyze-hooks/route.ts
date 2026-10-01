import { NextRequest, NextResponse } from 'next/server';
import { analyzeTranscriptWithGemini } from '@/lib/providers/geminiProvider';
import { calculateViralScore } from '@/lib/scoring/viralScoring';

export async function POST(req: NextRequest) {
  try {
    const { transcript, title = 'Video Hook Analysis', channelName = 'Creator', targetClipCount = 3 } = await req.json();

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 40) {
      return NextResponse.json(
        { error: 'A valid transcript of at least 40 characters is required for hook analysis.' },
        { status: 400 }
      );
    }

    const candidateMoments = await analyzeTranscriptWithGemini({
      videoTitle: title,
      channelName,
      transcriptText: transcript,
      targetClipCount: Math.min(10, Math.max(1, Number(targetClipCount) || 3)),
    });

    const evaluatedHooks = candidateMoments.map((moment) => {
      const scoreResult = calculateViralScore({
        title: moment.title,
        importantLine: moment.importantLine,
        whyThisLineIsImportant: moment.whyThisLineIsImportant,
        keyMomentType: moment.keyMomentType,
        duration: 45,
        wordsCount: moment.importantLine.split(' ').length + 25,
      });

      return {
        ...moment,
        viralScore: scoreResult.viralScore,
        confidence: scoreResult.confidence,
        scoreBreakdown: scoreResult.scoreBreakdown,
        scoreLabel: scoreResult.label,
      };
    });

    return NextResponse.json({
      success: true,
      modelUsed: 'gemini-2.5-flash',
      hooksCount: evaluatedHooks.length,
      viralHooks: evaluatedHooks,
    });
  } catch (error: any) {
    console.error('Analyze hooks API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to analyze transcript hooks.',
      },
      { status: 500 }
    );
  }
}
