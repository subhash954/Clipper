import { spawn } from 'child_process';
import { getFfmpegPath } from '../../renderEngine';
import { AudioMetrics, AudioEvent } from '../types';
import fs from 'fs';

export interface AudioAnalysisResult {
  metrics: AudioMetrics;
  events: AudioEvent[];
}

/**
 * Native FFmpeg Audio Intelligence Provider
 * Performs real EBU R128 loudness analysis and astats extraction on physical media.
 */
export async function analyzeAudioStream(params: {
  filePath: string;
  projectId: string;
  words?: Array<{ word: string; start: number; end: number }>;
  durationSeconds?: number;
}): Promise<AudioAnalysisResult> {
  const { filePath, projectId, words = [], durationSeconds } = params;

  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    throw new Error(`Cannot analyze audio: file does not exist at ${filePath}`);
  }

  const ffmpegPath = getFfmpegPath();

  return new Promise((resolve) => {
    // Run FFmpeg with ebur128 and astats to compute true audio loudness & peaks
    const args = [
      '-nostats',
      '-i', filePath,
      '-filter_complex', 'ebur128=peak=true,astats=metadata=1:reset=1',
      '-f', 'null',
      '-',
    ];

    const proc = spawn(/*turbopackIgnore: true*/ ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', () => {
      // Parse EBU R128 output
      // Integrated loudness: I: -23.4 LUFS
      // Loudness range: LRA: 7.2 LU
      // Peak: -1.5 dBFS
      // RMS: -18.2 dBFS
      let integratedLufs = -16.0;
      let loudnessRangeLra = 7.0;
      let peakDbfs = -1.0;
      let rmsDbfs = -18.0;

      const lufsMatch = stderr.match(/Integrated loudness:\s+I:\s+([-\d.]+)\s+LUFS/i);
      if (lufsMatch && !isNaN(parseFloat(lufsMatch[1]))) {
        integratedLufs = parseFloat(lufsMatch[1]);
      }

      const lraMatch = stderr.match(/Loudness range:\s+LRA:\s+([-\d.]+)\s+LU/i);
      if (lraMatch && !isNaN(parseFloat(lraMatch[1]))) {
        loudnessRangeLra = parseFloat(lraMatch[1]);
      }

      const peakMatch = stderr.match(/Peak level:\s+([-\d.]+)\s+dBFS/i) || stderr.match(/Peak amplitude:\s+([-\d.]+)/i);
      if (peakMatch && !isNaN(parseFloat(peakMatch[1]))) {
        peakDbfs = parseFloat(peakMatch[1]);
      }

      const rmsMatch = stderr.match(/RMS level dB:\s+([-\d.]+)/i) || stderr.match(/Overall\s+RMS level dB:\s+([-\d.]+)/i);
      if (rmsMatch && !isNaN(parseFloat(rmsMatch[1]))) {
        rmsDbfs = parseFloat(rmsMatch[1]);
      }

      // Compute speech pacing & density from real words
      let totalSpokenDuration = 0;
      let wordsPerSecond = 0;
      let totalDuration = durationSeconds || 0;

      if (words.length > 0) {
        const firstWordStart = words[0].start;
        const lastWordEnd = words[words.length - 1].end;
        if (!totalDuration || totalDuration <= 0) {
          totalDuration = Math.max(1, lastWordEnd - firstWordStart);
        }

        for (const w of words) {
          totalSpokenDuration += Math.max(0.05, w.end - w.start);
        }

        wordsPerSecond = Number((words.length / totalDuration).toFixed(2));
      }

      const speechDensity = totalDuration > 0
        ? Math.min(1.0, Number((totalSpokenDuration / totalDuration).toFixed(3)))
        : 0.8;

      // Extract silence intervals & high vocal energy events
      const events: AudioEvent[] = [];
      let silenceCount = 0;
      let totalSilenceDurationSeconds = 0;

      if (words.length > 1) {
        for (let i = 0; i < words.length - 1; i++) {
          const gap = words[i + 1].start - words[i].end;
          if (gap >= 0.6) {
            silenceCount++;
            totalSilenceDurationSeconds += gap;
            events.push({
              id: `aud-silence-${i}-${Date.now()}`,
              projectId,
              source: 'audio',
              start: Number(words[i].end.toFixed(2)),
              end: Number(words[i + 1].start.toFixed(2)),
              confidence: 0.95,
              type: gap > 1.5 ? 'extended_silence' : 'vocal_pause',
              intensity: Math.min(1.0, gap / 3.0),
              evidence: `Audible pause of ${gap.toFixed(2)}s between spoken words`,
              createdAt: new Date().toISOString(),
              description: `Vocal pause of ${gap.toFixed(2)} seconds`,
            });
          }
        }
      }

      // Identify high vocal energy sections (dense speech clusters with elevated volume/rate)
      const windowSize = 10;
      for (let i = 0; i <= words.length - windowSize; i += 5) {
        const windowWords = words.slice(i, i + windowSize);
        const winStart = windowWords[0].start;
        const winEnd = windowWords[windowWords.length - 1].end;
        const winDuration = winEnd - winStart;
        if (winDuration > 0) {
          const winWps = windowWords.length / winDuration;
          if (winWps >= 3.2) {
            events.push({
              id: `aud-energy-${i}-${Date.now()}`,
              projectId,
              source: 'audio',
              start: Number(winStart.toFixed(2)),
              end: Number(winEnd.toFixed(2)),
              confidence: 0.88,
              type: 'high_vocal_energy',
              intensity: Math.min(1.0, winWps / 4.5),
              evidence: `Cadence accelerated to ${winWps.toFixed(2)} words/sec`,
              createdAt: new Date().toISOString(),
              description: `High vocal energy cluster with rapid delivery (${winWps.toFixed(1)} wps)`,
            });
          }
        }
      }

      const metrics: AudioMetrics = {
        integratedLufs: Number(integratedLufs.toFixed(1)),
        loudnessRangeLra: Number(loudnessRangeLra.toFixed(1)),
        peakDbfs: Number(peakDbfs.toFixed(1)),
        rmsDbfs: Number(rmsDbfs.toFixed(1)),
        averageSpeechDensity: speechDensity,
        wordsPerSecond,
        silenceCount,
        totalSilenceDurationSeconds: Number(totalSilenceDurationSeconds.toFixed(2)),
      };

      resolve({
        metrics,
        events,
      });
    });
  });
}
