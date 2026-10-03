import { WordTimestamp, Transcript, TranscriptUtterance } from '../types';

export class DeepgramProviderError extends Error {
  constructor(message: string, public statusCode?: number, public isRetryable: boolean = false) {
    super(message);
    this.name = 'DeepgramProviderError';
  }
}

export const parseTimestamp = (val: any): number => {
  const num = Number(val || 0);
  return Math.round(num * 1000) / 1000;
};

export const parseConfidence = (val: any): number | undefined => {
  if (val === undefined || val === null) return undefined;
  const num = Number(val);
  return Math.round(num * 10000) / 10000;
};

/**
 * Production Deepgram Nova-2 speech-to-text provider.
 * Extracts authentic word-level timestamps with confidence and speaker separation.
 */
export async function transcribeWithDeepgram(params: {
  audioUrl?: string;
  audioBuffer?: Buffer;
  mimetype?: string;
  timeoutMs?: number;
}): Promise<Transcript> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new DeepgramProviderError(
      'Deepgram API key is not configured on the server. Please set DEEPGRAM_API_KEY in .env.local.',
      500,
      false
    );
  }

  const { audioUrl, audioBuffer, mimetype = 'audio/mp4', timeoutMs = 45000 } = params;

  if (!audioUrl && !audioBuffer) {
    throw new DeepgramProviderError('Either audioUrl or audioBuffer must be provided for transcription.', 400, false);
  }

  const queryParams = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: 'true',
    utterances: 'true',
    words: 'true',
    diarize: 'true',
  });

  const url = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;

  let attempts = 0;
  const maxAttempts = 3;
  let lastError: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        Authorization: `Token ${apiKey}`,
      };

      let body: any;
      if (audioBuffer) {
        headers['Content-Type'] = mimetype;
        body = audioBuffer;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ url: audioUrl });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const isRetryable = response.status === 429 || response.status >= 500;
        throw new DeepgramProviderError(
          `Deepgram API error (${response.status}): ${errorText.slice(0, 200) || response.statusText}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      const channel = data.results?.channels?.[0]?.alternatives?.[0];

      if (!channel) {
        throw new DeepgramProviderError('Deepgram returned an empty transcription result.', 500, false);
      }

      const transcriptText: string = channel.transcript || '';
      const rawWords: any[] = channel.words || [];

      const words: WordTimestamp[] = rawWords.map((w) => ({
        word: (w.punctuated_word || w.word || '').trim(),
        start: parseTimestamp(w.start),
        end: parseTimestamp(w.end),
        confidence: parseConfidence(w.confidence),
        speaker: w.speaker !== undefined ? Number(w.speaker) : undefined,
      }));

      const rawUtterances: any[] = data.results?.utterances || [];
      const utterances: TranscriptUtterance[] = rawUtterances.map((u) => ({
        text: u.transcript || '',
        start: parseTimestamp(u.start),
        end: parseTimestamp(u.end),
        speaker: u.speaker !== undefined ? Number(u.speaker) : undefined,
        words: (u.words || []).map((w: any) => ({
          word: (w.punctuated_word || w.word || '').trim(),
          start: parseTimestamp(w.start),
          end: parseTimestamp(w.end),
          confidence: parseConfidence(w.confidence),
          speaker: w.speaker !== undefined ? Number(w.speaker) : undefined,
        })),
      }));

      return {
        text: transcriptText,
        words,
        utterances,
        language: data.results?.channels?.[0]?.detected_language || 'en',
        source: 'deepgram',
      };
    } catch (err: any) {
      lastError = err;
      if (err instanceof DeepgramProviderError && !err.isRetryable) {
        throw err;
      }
      if (attempts < maxAttempts) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
      }
    }
  }

  throw new DeepgramProviderError(
    `Failed to transcribe audio with Deepgram after ${maxAttempts} attempts: ${lastError?.message || 'Network timeout'}`,
    500,
    false
  );
}
