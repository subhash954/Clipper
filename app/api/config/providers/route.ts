import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const deepgramConfigured = Boolean(process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY.trim() !== '');
  const pexelsConfigured = Boolean(process.env.PEXELS_API_KEY && process.env.PEXELS_API_KEY.trim() !== '');
  const pixabayConfigured = Boolean(process.env.PIXABAY_API_KEY && process.env.PIXABAY_API_KEY.trim() !== '');
  const supabaseConfigured = isSupabaseConfigured();

  return NextResponse.json({
    success: true,
    providers: {
      gemini: {
        name: 'Google Gemini 2.5 Flash',
        isConfigured: geminiConfigured,
        role: 'Hook Mining & Transcript Analysis',
      },
      deepgram: {
        name: 'Deepgram Nova-2',
        isConfigured: deepgramConfigured,
        role: 'Word-Level Audio Transcription & Diarization',
      },
      pexels: {
        name: 'Pexels API',
        isConfigured: pexelsConfigured,
        role: '9:16 Vertical Stock Video B-Roll (Primary)',
      },
      pixabay: {
        name: 'Pixabay API',
        isConfigured: pixabayConfigured,
        role: 'Stock Video & Sound Effects (Fallback)',
      },
      supabase: {
        name: 'Supabase PostgreSQL',
        isConfigured: supabaseConfigured,
        role: 'Production Database & Storage',
      },
    },
    security: {
      storageLocation: 'Server-Side Environment Variables (.env.local)',
      clientExposed: false,
    },
  });
}
