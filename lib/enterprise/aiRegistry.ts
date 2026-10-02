import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  CircuitBreakerState,
  CircuitBreakerConfig,
  AIProviderStatus,
  AIRequestMeta,
} from './types';

export interface IAIModelProvider {
  id: string;
  generateText(prompt: string, options?: Record<string, any>): Promise<{ text: string; tokensUsed: number; costUSD: number }>;
}

export class MockOrchestratedProvider implements IAIModelProvider {
  id: string;
  private shouldFail: boolean = false;

  constructor(id: string) {
    this.id = id;
  }

  setFailing(fail: boolean) {
    this.shouldFail = fail;
  }

  async generateText(prompt: string): Promise<{ text: string; tokensUsed: number; costUSD: number }> {
    if (this.shouldFail) {
      throw new Error(`Provider ${this.id} downstream error: 503 Service Unavailable`);
    }
    return {
      text: `Generated response from ${this.id} for: ${prompt.substring(0, 30)}...`,
      tokensUsed: 150,
      costUSD: 0.0003,
    };
  }
}

export class AIProviderRegistry {
  private baseDir = path.join(process.cwd(), 'data', 'enterprise');
  private cacheFile = path.join(process.cwd(), 'data', 'enterprise', 'ai_cache.json');
  private providers = new Map<string, IAIModelProvider>();
  private circuitBreakers = new Map<string, AIProviderStatus>();

  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTimeMs: 15_000,
    timeoutMs: 10_000,
  };

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private readCache(): Record<string, any> {
    try {
      if (fs.existsSync(this.cacheFile)) {
        return JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return {};
  }

  private writeCache(cache: Record<string, any>): void {
    fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
  }

  registerProvider(provider: IAIModelProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.circuitBreakers.has(provider.id)) {
      this.circuitBreakers.set(provider.id, {
        providerId: provider.id,
        circuitState: 'CLOSED',
        consecutiveFailures: 0,
      });
    }
  }

  getCircuitStatus(providerId: string): AIProviderStatus {
    let status = this.circuitBreakers.get(providerId);
    if (!status) {
      status = { providerId, circuitState: 'CLOSED', consecutiveFailures: 0 };
      this.circuitBreakers.set(providerId, status);
    }

    // Check if recovery window expired to move from OPEN to HALF_OPEN
    if (status.circuitState === 'OPEN' && status.recoveryAt) {
      if (Date.now() >= new Date(status.recoveryAt).getTime()) {
        status.circuitState = 'HALF_OPEN';
      }
    }

    return status;
  }

  private recordSuccess(providerId: string): void {
    const status = this.getCircuitStatus(providerId);
    status.circuitState = 'CLOSED';
    status.consecutiveFailures = 0;
    status.lastSuccessAt = new Date().toISOString();
    status.recoveryAt = undefined;
  }

  private recordFailure(providerId: string): void {
    const status = this.getCircuitStatus(providerId);
    status.consecutiveFailures += 1;
    status.lastFailureAt = new Date().toISOString();

    if (status.consecutiveFailures >= this.defaultConfig.failureThreshold) {
      status.circuitState = 'OPEN';
      status.recoveryAt = new Date(Date.now() + this.defaultConfig.recoveryTimeMs).toISOString();
    }
  }

  /**
   * Executes AI generation with circuit breaker, caching, and graceful fallback
   */
  async executeWithFallback(
    primaryProviderId: string,
    fallbackProviderId: string,
    prompt: string,
    options: {
      promptVersion?: string;
      schemaVersion?: string;
      model?: string;
      skipCache?: boolean;
    } = {}
  ): Promise<{
    text: string;
    tokensUsed: number;
    costUSD: number;
    providerUsed: string;
    cached: boolean;
    fallbackUsed: boolean;
  }> {
    const promptVersion = options.promptVersion || 'v1.0';
    const requestHash = crypto
      .createHash('sha256')
      .update(`${prompt}:${promptVersion}:${options.model || 'default'}`)
      .digest('hex');

    // 1. Check deterministic cache
    if (!options.skipCache) {
      const cache = this.readCache();
      if (cache[requestHash]) {
        return {
          ...cache[requestHash],
          cached: true,
          fallbackUsed: false,
        };
      }
    }

    // 2. Try primary provider if circuit is not OPEN
    const primaryStatus = this.getCircuitStatus(primaryProviderId);
    const primary = this.providers.get(primaryProviderId);

    if (primary && primaryStatus.circuitState !== 'OPEN') {
      try {
        const res = await primary.generateText(prompt, options);
        this.recordSuccess(primaryProviderId);

        // Cache result
        const cache = this.readCache();
        cache[requestHash] = {
          text: res.text,
          tokensUsed: res.tokensUsed,
          costUSD: res.costUSD,
          providerUsed: primaryProviderId,
        };
        this.writeCache(cache);

        return {
          ...res,
          providerUsed: primaryProviderId,
          cached: false,
          fallbackUsed: false,
        };
      } catch (err: any) {
        this.recordFailure(primaryProviderId);
      }
    }

    // 3. Fallback to secondary provider
    const fallback = this.providers.get(fallbackProviderId);
    if (!fallback) {
      throw new Error(`Primary provider ${primaryProviderId} failed, and fallback ${fallbackProviderId} is not configured.`);
    }

    try {
      const res = await fallback.generateText(prompt, options);
      this.recordSuccess(fallbackProviderId);

      return {
        ...res,
        providerUsed: fallbackProviderId,
        cached: false,
        fallbackUsed: true,
      };
    } catch (fallbackErr: any) {
      this.recordFailure(fallbackProviderId);
      throw new Error(`Both primary (${primaryProviderId}) and fallback (${fallbackProviderId}) AI providers failed: ${fallbackErr.message}`);
    }
  }
}

// Singleton
let aiRegistryInstance: AIProviderRegistry | null = null;

export function getAIProviderRegistry(): AIProviderRegistry {
  if (!aiRegistryInstance) {
    aiRegistryInstance = new AIProviderRegistry();
  }
  return aiRegistryInstance;
}
