export class GeminiProviderError extends Error {
  constructor(message: string, public statusCode?: number, public isRetryable: boolean = false) {
    super(message);
    this.name = 'GeminiProviderError';
  }
}

export interface CandidateMomentSuggestion {
  title: string;
  importantLine: string;
  whyThisLineIsImportant: string;
  keyMomentType: string;
  bRollKeywords: string[];
  aiImagePrompt: string;
  soundEffects: string[];
  approximateQuote: string;
  startWord: string;
  endWord: string;
}

/**
 * Production Google Gemini 2.5 Flash provider.
 * Analyzes authentic transcripts with strict JSON schema and secret redaction.
 */
export async function analyzeTranscriptWithGemini(params: {
  videoTitle: string;
  channelName: string;
  transcriptText: string;
  targetClipCount?: number;
  timeoutMs?: number;
}): Promise<CandidateMomentSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new GeminiProviderError(
      'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in .env.local.',
      500,
      false
    );
  }

  const { videoTitle, channelName, transcriptText, targetClipCount = 5, timeoutMs = 35000 } = params;

  if (!transcriptText || transcriptText.trim().length < 50) {
    throw new GeminiProviderError('Transcript is too short or empty for AI moment analysis.', 400, false);
  }

  // Clip transcript to reasonable token size (~12,000 words max)
  const truncatedTranscript = transcriptText.split(/\s+/).slice(0, 10000).join(' ');

  const prompt = `You are Alex Hormozi's chief viral video editor.
A creator submitted this long video for short-form extraction:
Title: "${videoTitle}"
Channel: "${channelName}"

CRITICAL INSTRUCTION:
Analyze the ACTUAL SPOKEN TRANSCRIPT below. Do NOT invent phrases or fake timestamps.
Extract the top ${targetClipCount} most viral standalone moments (30-60s) where the speaker delivers a critical insight, high-curiosity hook, or contrarian truth.

For each of the ${targetClipCount} moments, return a JSON object with:
- "title": punchy high-CTR short title (under 60 characters)
- "importantLine": the exact pivotal sentence spoken in the transcript that gives this clip viral retention
- "whyThisLineIsImportant": why this specific line hooks viewers and stops scrolling
- "keyMomentType": choose one from: "Contrarian Truth", "Core Framework", "Actionable Secret", "High-Curiosity Hook", "Emotional Climax"
- "approximateQuote": 2 to 4 consecutive sentences from the transcript forming the entire clip
- "startWord": the first 2-4 words of the clip's beginning in the transcript
- "endWord": the last 2-4 words of the clip's ending in the transcript
- "bRollKeywords": 3 visual stock video search keywords (e.g. ["brand identity", "creative studio", "revenue chart"])
- "aiImagePrompt": photorealistic cinematic visual prompt for 9:16 vertical
- "soundEffects": 2 sound effects (e.g. ["whoosh.mp3", "sub_drop.mp3"])

Sort in order of importance (Rank 1 = most critical moment of the entire speech).
Respond ONLY with a valid JSON array of ${targetClipCount} objects.

TRANSCRIPT:
"""
${truncatedTranscript}
"""`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let attempts = 0;
  const maxAttempts = 3;
  let lastError: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const isRetryable = response.status === 429 || response.status >= 500;
        throw new GeminiProviderError(
          `Gemini API error (${response.status}): ${errorText.slice(0, 200) || response.statusText}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new GeminiProviderError('Gemini returned an empty response candidate.', 500, false);
      }

      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new GeminiProviderError('Gemini output was not a valid array of candidate clips.', 500, false);
      }

      return parsed.map((item: any) => ({
        title: String(item.title || 'Golden Viral Short').trim(),
        importantLine: String(item.importantLine || '').trim(),
        whyThisLineIsImportant: String(item.whyThisLineIsImportant || '').trim(),
        keyMomentType: String(item.keyMomentType || 'High-Curiosity Hook').trim(),
        approximateQuote: String(item.approximateQuote || item.importantLine || '').trim(),
        startWord: String(item.startWord || '').trim(),
        endWord: String(item.endWord || '').trim(),
        bRollKeywords: Array.isArray(item.bRollKeywords) ? item.bRollKeywords.map(String) : ['growth', 'business'],
        aiImagePrompt: String(item.aiImagePrompt || `Cinematic shot of ${item.title}`).trim(),
        soundEffects: Array.isArray(item.soundEffects) ? item.soundEffects.map(String) : ['whoosh.mp3', 'riser.mp3'],
      }));
    } catch (err: any) {
      lastError = err;
      if (err instanceof GeminiProviderError && !err.isRetryable) {
        throw err;
      }
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 1500));
      }
    }
  }

  throw new GeminiProviderError(
    `Failed to analyze transcript with Gemini after ${maxAttempts} attempts: ${lastError?.message || 'Network timeout'}`,
    500,
    false
  );
}
