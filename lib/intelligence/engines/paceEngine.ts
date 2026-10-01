import { EditorialPaceSegment } from '../types';

export interface PaceAnalysisWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Editorial Pace Intelligence Engine
 * Evaluates spoken cadence, pause duration, and delivery velocity across the timeline.
 * Labeled strictly as 'editorial pacing analysis' — never fabricated viewer metrics.
 */
export function analyzeEditorialPacing(params: {
  words: PaceAnalysisWord[];
  projectId: string;
  windowSizeSeconds?: number;
}): EditorialPaceSegment[] {
  const { words, projectId, windowSizeSeconds = 15 } = params;

  if (words.length === 0) return [];

  const firstTime = words[0].start;
  const lastTime = words[words.length - 1].end;
  const totalDuration = lastTime - firstTime;

  const segments: EditorialPaceSegment[] = [];
  const numWindows = Math.max(1, Math.ceil(totalDuration / windowSizeSeconds));

  for (let wIdx = 0; wIdx < numWindows; wIdx++) {
    const winStart = firstTime + wIdx * windowSizeSeconds;
    const winEnd = Math.min(lastTime, winStart + windowSizeSeconds);
    const winWords = words.filter((w) => w.start >= winStart && w.end <= winEnd);

    if (winWords.length === 0) continue;

    const actualDuration = Math.max(0.5, winWords[winWords.length - 1].end - winWords[0].start);
    const wps = Number((winWords.length / actualDuration).toFixed(2));

    // Calculate pauses within the window
    let totalPauseSeconds = 0;
    let pauseCount = 0;
    for (let i = 0; i < winWords.length - 1; i++) {
      const gap = winWords[i + 1].start - winWords[i].end;
      if (gap > 0.4) {
        totalPauseSeconds += gap;
        pauseCount++;
      }
    }
    const avgPause = pauseCount > 0 ? Number((totalPauseSeconds / pauseCount).toFixed(2)) : 0.15;

    let energyLevel: 'low' | 'normal' | 'high' = 'normal';
    let pacingCategory: EditorialPaceSegment['pacingCategory'] = 'balanced';

    if (wps >= 3.2) {
      energyLevel = 'high';
      pacingCategory = 'fast_urgent';
    } else if (wps <= 1.8) {
      energyLevel = 'low';
      pacingCategory = 'slow_deliberate';
    } else if (wps >= 2.5 && avgPause < 0.25) {
      energyLevel = 'normal';
      pacingCategory = 'dense_framework';
    }

    segments.push({
      id: `pace-seg-${wIdx}-${Date.now()}`,
      projectId,
      source: 'audio',
      start: Number(winStart.toFixed(2)),
      end: Number(winEnd.toFixed(2)),
      confidence: 0.95,
      wordsPerSecond: wps,
      averagePauseDurationSeconds: avgPause,
      energyLevel,
      pacingCategory,
      evidence: `Pacing window of ${winWords.length} words over ${actualDuration.toFixed(1)}s`,
      createdAt: new Date().toISOString(),
    });
  }

  return segments;
}
