import fs from 'fs';
import path from 'path';

export interface TTSGenerationResult {
  success: boolean;
  audioUrl?: string;
  durationSeconds?: number;
  provider: string;
  error?: string;
}

export interface ITTSProvider {
  name: string;
  isConfigured(): boolean;
  synthesize(text: string, voiceId?: string): Promise<TTSGenerationResult>;
}

/**
 * ElevenLabs Speech Provider
 */
export class ElevenLabsTTSProvider implements ITTSProvider {
  name = 'elevenlabs';

  isConfigured(): boolean {
    const key = process.env.ELEVENLABS_API_KEY;
    return Boolean(key && key.trim() !== '' && !key.includes('placeholder'));
  }

  async synthesize(text: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM'): Promise<TTSGenerationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.name,
        error: 'ElevenLabs API key is not configured. Please set ELEVENLABS_API_KEY in server environment.',
      };
    }

    const apiKey = process.env.ELEVENLABS_API_KEY!;
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          provider: this.name,
          error: `ElevenLabs synthesis failed (${res.status}): ${errText}`,
        };
      }

      const audioBuffer = Buffer.from(await res.arrayBuffer());
      const fileName = `tts_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.mp3`;
      const exportDir = path.join(process.cwd(), 'public', 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const filePath = path.join(exportDir, fileName);
      fs.writeFileSync(filePath, audioBuffer);

      return {
        success: true,
        audioUrl: `/exports/${fileName}`,
        durationSeconds: Math.max(1, text.split(' ').length / 2.5),
        provider: this.name,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: `ElevenLabs request error: ${err.message}`,
      };
    }
  }
}

/**
 * Returns the active TTS Provider
 */
export function getTTSProvider(): ITTSProvider {
  return new ElevenLabsTTSProvider();
}
