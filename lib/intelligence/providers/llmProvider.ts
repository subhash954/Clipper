import { ProviderUsageRecord, FailureRecord } from '../types';

export interface LLMRequestOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface LLMResponse<T> {
  data: T;
  rawText: string;
  usage: ProviderUsageRecord;
}

export interface ILLMProvider {
  name: string;
  generateStructuredJson<T>(options: LLMRequestOptions): Promise<LLMResponse<T>>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public isRetryable: boolean = false,
    public rawResponse?: string
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

/**
 * Enterprise Google Gemini LLM Provider (Flash / Pro)
 * Includes token telemetry, timeout management, and exponential backoff retry.
 */
export class GeminiLLMProvider implements ILLMProvider {
  name = 'google-gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model;
  }

  async generateStructuredJson<T>(options: LLMRequestOptions): Promise<LLMResponse<T>> {
    if (!this.apiKey) {
      throw new LLMProviderError(
        'Gemini API key is not configured on the server. Please set GEMINI_API_KEY.',
        this.name,
        500,
        false
      );
    }

    const {
      prompt,
      systemInstruction = 'You are an elite video intelligence strategist. Always output strictly valid JSON.',
      temperature = 0.2,
      maxOutputTokens = 8192,
      timeoutMs = 45000,
    } = options;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const contents: any[] = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const body: any = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
        maxOutputTokens,
      },
    };

    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          const isRetryable = response.status === 429 || response.status >= 500;
          if (isRetryable && attempts < maxAttempts) {
            const backoffMs = Math.pow(2, attempts) * 1000 + Math.random() * 500;
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          throw new LLMProviderError(
            `Gemini API request failed with status ${response.status}: ${errText}`,
            this.name,
            response.status,
            isRetryable,
            errText
          );
        }

        const json = await response.json();
        const latencyMs = Date.now() - startTime;
        const candidate = json.candidates?.[0];

        if (!candidate || !candidate.content?.parts?.[0]?.text) {
          throw new LLMProviderError(
            'Gemini returned an empty candidate or missing text content',
            this.name,
            502,
            true
          );
        }

        const rawText = candidate.content.parts[0].text;
        let parsedData: T;

        try {
          parsedData = JSON.parse(rawText);
        } catch (parseErr: any) {
          // Attempt markdown fence extraction if present
          const cleaned = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
          parsedData = JSON.parse(cleaned);
        }

        const usageMetadata = json.usageMetadata || {};
        const inputTokens = usageMetadata.promptTokenCount || Math.ceil(prompt.length / 4);
        const outputTokens = usageMetadata.candidatesTokenCount || Math.ceil(rawText.length / 4);

        // Standard Gemini 2.5 Flash pricing: ~$0.075 / 1M prompt tokens, ~$0.30 / 1M candidate tokens
        const costUsd = (inputTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.3;

        const usage: ProviderUsageRecord = {
          provider: this.name,
          model: this.model,
          inputTokens,
          outputTokens,
          imagesAnalyzed: 0,
          audioDurationSeconds: 0,
          latencyMs,
          requestId,
          costUsd: Number(costUsd.toFixed(6)),
          isEstimatedCost: !usageMetadata.promptTokenCount,
        };

        return {
          data: parsedData,
          rawText,
          usage,
        };
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') {
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw new LLMProviderError(`Gemini request timed out after ${timeoutMs}ms`, this.name, 504, true);
        }
        if (err instanceof LLMProviderError) {
          throw err;
        }
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    throw new LLMProviderError(
      `Gemini request failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown network error'}`,
      this.name,
      500,
      false
    );
  }
}
