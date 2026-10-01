import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { renderClipWithFfmpeg } from '@/lib/renderEngine';
import { WordTimestamp } from '@/lib/types';

export async function POST() {
  try {
    const testJobId = `e2e-test-${Date.now()}`;
    const testSampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

    const testWords: WordTimestamp[] = [
      { word: 'STOP', start: 0.5, end: 1.0 },
      { word: 'BUILDING', start: 1.0, end: 1.6 },
      { word: 'A', start: 1.6, end: 1.9 },
      { word: 'BRAND', start: 1.9, end: 2.6 },
      { word: 'START', start: 2.8, end: 3.4 },
      { word: 'BUILDING', start: 3.4, end: 4.0 },
      { word: 'A', start: 4.0, end: 4.3 },
      { word: 'WORLD', start: 4.3, end: 5.0 },
    ];

    const progressLogs: Array<{ progress: number; stage: string }> = [];

    const result = await renderClipWithFfmpeg(
      testJobId,
      {
        inputMedia: testSampleUrl,
        startTime: 0,
        duration: 5,
        words: testWords,
        isProUser: true,
      },
      (progress, stage) => {
        progressLogs.push({ progress, stage });
      }
    );

    const fileExists = fs.existsSync(result.filePath);
    const stat = fileExists ? fs.statSync(result.filePath) : null;

    return NextResponse.json({
      success: true,
      testName: 'E2E 9:16 Video Composition Test',
      jobId: testJobId,
      outputUrl: result.outputUrl,
      fileExists,
      fileSizeBytes: stat?.size || 0,
      duration: result.duration,
      progressStepsReported: progressLogs.length,
      finalStage: progressLogs[progressLogs.length - 1]?.stage,
    });
  } catch (error: any) {
    console.error('E2E render test error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'E2E render test failed' },
      { status: 500 }
    );
  }
}
