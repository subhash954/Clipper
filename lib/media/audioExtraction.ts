import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getFfmpegPath } from '../renderEngine';

export interface AudioExtractionResult {
  success: boolean;
  audioPath: string;
  durationSeconds?: number;
  error?: string;
}

/**
 * Extracts 16kHz mono audio from a video container using native FFmpeg.
 * Perfect optimization for speech-to-text transcription (Deepgram Nova-2).
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputAudioPath?: string
): Promise<AudioExtractionResult> {
  if (!fs.existsSync(videoPath)) {
    return {
      success: false,
      audioPath: '',
      error: `Input video does not exist: ${videoPath}`,
    };
  }

  const targetAudioPath =
    outputAudioPath ||
    path.join(
      path.dirname(videoPath),
      `${path.basename(videoPath, path.extname(videoPath))}_extracted.mp3`
    );

  const ffmpeg = getFfmpegPath();
  const args = [
    '-y',
    '-i', videoPath,
    '-vn',                     // Disable video
    '-acodec', 'libmp3lame',   // MP3 codec
    '-ar', '16000',            // 16kHz sample rate optimal for speech
    '-ac', '1',                // Mono channel
    '-q:a', '2',               // High quality VBR
    targetAudioPath,
  ];

  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(/*turbopackIgnore: true*/ targetAudioPath)) {
        const stats = fs.statSync(/*turbopackIgnore: true*/ targetAudioPath);
        if (stats.size > 0) {
          resolve({
            success: true,
            audioPath: targetAudioPath,
          });
          return;
        }
      }

      resolve({
        success: false,
        audioPath: '',
        error: stderr.trim() || `FFmpeg audio extraction exited with code ${code}`,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        audioPath: '',
        error: `Failed to spawn FFmpeg for audio extraction: ${err.message}`,
      });
    });
  });
}
