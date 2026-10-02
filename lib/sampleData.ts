import { WordTimestamp, ViralClip, SubtitleStyle, SubtitleLanguage } from './types';

/**
 * EXPLICIT DEMO FIXTURES ONLY
 * These constants are strictly used when the user clicks "Try Demo" in the Studio.
 * Production projects MUST use authentic user media, uploaded videos, or ingested YouTube transcripts.
 */
export const DEMO_PROJECT_LABEL = "DEMO PROJECT — Entrepreneur Mindset";
export const DEMO_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

// Feature 18: Satisfying split-screen background gameplay (Subway / Parkour / Minecraft loop)
export const SATISFYING_VIDEO_URLS = {
  subway: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  minecraft: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
  gta: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  none: ""
};

// Word-by-word timestamps matching energetic speech
export const DEMO_WORDS: WordTimestamp[] = [
  { word: "IF", start: 0.2, end: 0.5 },
  { word: "YOU", start: 0.5, end: 0.8 },
  { word: "WANT", start: 0.8, end: 1.1 },
  { word: "TO", start: 1.1, end: 1.3 },
  { word: "BUILD", start: 1.3, end: 1.7 },
  { word: "A", start: 1.7, end: 1.9 },
  { word: "TEN", start: 1.9, end: 2.3 },
  { word: "THOUSAND", start: 2.3, end: 2.8 },
  { word: "DOLLAR", start: 2.8, end: 3.3 },
  { word: "BUSINESS,", start: 3.3, end: 3.9 },
  { word: "STOP", start: 4.1, end: 4.5 },
  { word: "OVERTHINKING", start: 4.5, end: 5.2 },
  { word: "AND", start: 5.2, end: 5.4 },
  { word: "START", start: 5.4, end: 5.8 },
  { word: "CREATING", start: 5.8, end: 6.3 },
  { word: "VALUE", start: 6.3, end: 6.8 },
  { word: "EVERY", start: 7.0, end: 7.4 },
  { word: "SINGLE", start: 7.4, end: 7.8 },
  { word: "DAY!", start: 7.8, end: 8.5 },
  { word: "MOST", start: 8.8, end: 9.2 },
  { word: "PEOPLE", start: 9.2, end: 9.6 },
  { word: "WAIT", start: 9.6, end: 10.0 },
  { word: "FOR", start: 10.0, end: 10.3 },
  { word: "PERFECTION,", start: 10.3, end: 11.0 },
  { word: "BUT", start: 11.2, end: 11.5 },
  { word: "SPEED", start: 11.5, end: 12.0 },
  { word: "WINS", start: 12.0, end: 12.4 },
  { word: "THE", start: 12.4, end: 12.6 },
  { word: "GAME", start: 12.6, end: 13.2 },
  { word: "EVERY", start: 13.4, end: 13.8 },
  { word: "TIME.", start: 13.8, end: 14.5 }
];

// Backwards compatibility alias for components
export const SAMPLE_WORDS = DEMO_WORDS;
export const sampleTranscriptWords = DEMO_WORDS;
export const SAMPLE_VIDEO_URL = DEMO_VIDEO_URL;

// Feature 10 & 11: Multi-language Translations for Dual Subtitles
export const SAMPLE_TRANSLATIONS: Record<SubtitleLanguage, Record<string, string>> = {
  en: {},
  hi: {
    "IF": "अगर",
    "YOU": "आप",
    "WANT": "चाहते हैं",
    "TO": "",
    "BUILD": "बनाना",
    "A": "एक",
    "TEN": "दस",
    "THOUSAND": "हज़ार",
    "DOLLAR": "डॉलर",
    "BUSINESS,": "का बिज़नेस,",
    "STOP": "तो बंद करो",
    "OVERTHINKING": "ज़्यादा सोचना",
    "AND": "और",
    "START": "शुरू करो",
    "CREATING": "वैल्यू",
    "VALUE": "देना",
    "EVERY": "हर",
    "SINGLE": "एक",
    "DAY!": "दिन!",
    "MOST": "ज़्यादातर",
    "PEOPLE": "लोग",
    "WAIT": "इंतज़ार करते हैं",
    "FOR": "",
    "PERFECTION,": "परफेक्शन का,",
    "BUT": "लेकिन",
    "SPEED": "रफ़्तार",
    "WINS": "जीतती है",
    "THE": "",
    "GAME": "खेल",
    "TIME.": "बार।"
  },
  es: {
    "IF": "SI",
    "YOU": "QUIERES",
    "WANT": "CONSTRUIR",
    "BUILD": "UN NEGOCIO",
    "DOLLAR": "DE $10K,",
    "STOP": "DEJA DE",
    "OVERTHINKING": "PENSAR",
    "START": "Y COMIENZA",
    "CREATING": "A CREAR",
    "VALUE": "VALOR",
    "SPEED": "LA VELOCIDAD",
    "WINS": "GANA",
    "GAME": "EL JUEGO"
  },
  fr: {
    "IF": "SI",
    "YOU": "TU VEUX",
    "WANT": "CRÉER",
    "BUILD": "UN BUSINESS",
    "DOLLAR": "DE 10K,",
    "STOP": "ARRÊTE DE",
    "OVERTHINKING": "TROP PENSER",
    "START": "ET COMMENCE",
    "CREATING": "À CRÉER",
    "VALUE": "DE LA VALEUR",
    "SPEED": "LA VITESSE",
    "WINS": "GAGNE",
    "GAME": "LE JEU"
  },
  de: {
    "IF": "WENN",
    "YOU": "DU",
    "WANT": "WILLST",
    "BUILD": "EIN BUSINESS",
    "DOLLAR": "VON $10K,",
    "STOP": "HÖR AUF ZU",
    "OVERTHINKING": "GRÜBELN",
    "START": "UND FANG AN",
    "CREATING": "MEHRWERT",
    "VALUE": "ZU SCHAFFEN",
    "SPEED": "GESCHWINDIGKEIT",
    "WINS": "GEWINNT",
    "GAME": "DAS SPIEL"
  }
};

// Demo Clips for explicit demo mode exploration
export const DEMO_VIRAL_CLIPS: ViralClip[] = [
  {
    id: "demo-clip-1",
    rank: 1,
    title: "⚡ Stop Overthinking ($10k Business Secret)",
    hookSummary: "Challenges the perfectionism trap directly in the first 3 seconds.",
    importantLine: "If you want to build a ten thousand dollar business, stop overthinking.",
    whyThisLineIsImportant: "Attacks overthinking and compels immediate viewer agreement.",
    keyMomentType: "Contrarian Truth",
    start: 0,
    end: 8.5,
    duration: 8.5,
    viralScore: 88,
    scoreBreakdown: {
      hook: 92,
      curiosity: 86,
      value: 88,
      emotion: 84,
      standalone: 90
    },
    confidence: 0.95,
    alignmentStatus: 'verified',
    alignmentConfidence: 0.96,
    qualityStatus: 'verified',
    tags: ["High Energy", "Strong Hook", "Mindset"],
    hookStrength: 92,
    retentionEstimate: 85,
    energyLevel: 'High',
    words: DEMO_WORDS.slice(0, 19)
  },
  {
    id: "demo-clip-2",
    rank: 2,
    title: "⚡ Speed Over Perfection Wins The Game",
    hookSummary: "Direct psychological punchline revealing why most creators hesitate.",
    importantLine: "Most people wait for perfection, but speed wins the game every time.",
    whyThisLineIsImportant: "Contrasts delayed perfection with immediate execution speed.",
    keyMomentType: "Core Framework",
    start: 8.8,
    end: 14.5,
    duration: 5.7,
    viralScore: 84,
    scoreBreakdown: {
      hook: 85,
      curiosity: 82,
      value: 86,
      emotion: 80,
      standalone: 87
    },
    confidence: 0.92,
    alignmentStatus: 'verified',
    alignmentConfidence: 0.94,
    qualityStatus: 'verified',
    tags: ["Actionable", "Motivational", "Shareable"],
    hookStrength: 85,
    retentionEstimate: 80,
    energyLevel: 'High',
    words: DEMO_WORDS.slice(19, 31)
  }
];

export const SAMPLE_VIRAL_CLIPS = DEMO_VIRAL_CLIPS;

export const AI_SOCIAL_METADATA = {
  viralTitles: [
    "The harsh truth about making your first $10k 🤫 #shorts",
    "Stop waiting for perfection (Do THIS instead) ⚡",
    "Why 90% fail before they even start 💡"
  ],
  viralDescription: "Want to scale to $10,000/month? Speed wins over perfection every single time. Stop overthinking and start building value today. Subscribe for daily creator growth tips! 🚀",
  hashtags: ["#entrepreneur", "#productivity", "#mindset", "#shorts", "#viral", "#businessgrowth", "#wealth"]
};

// Feature 26: AI Best Frame Thumbnails
export const AI_THUMBNAILS = [
  { time: 3.4, label: "Peak Conviction Frame" },
  { time: 8.0, label: "Direct Hook Stare" },
  { time: 12.2, label: "Dynamic Speech Gesture" }
];

/**
 * ORIGINAL CLIPPER PRESET STYLES
 * Professional typography system with distinctive brand presets.
 */
export const PRESET_STYLES: Record<string, SubtitleStyle> = {
  signal: {
    preset: 'signal',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 46,
    primaryColor: '#FFFFFF',
    highlightColor: '#06B6D4', // Clipper Cyan
    strokeColor: '#0B0F17',
    strokeWidth: 5,
    position: 'bottom',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  punch: {
    preset: 'punch',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 52,
    primaryColor: '#FFFFFF',
    highlightColor: '#FACC15', // Gold Punch
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'bounce',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  focus: {
    preset: 'focus',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 44,
    primaryColor: '#F8FAFC',
    highlightColor: '#22D3EE', // Aqua Focus
    strokeColor: '#0F172A',
    strokeWidth: 4,
    position: 'bottom',
    uppercase: false,
    showEmojis: false,
    animation: 'karaoke',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  },
  kinetic: {
    preset: 'kinetic',
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 50,
    primaryColor: '#FFFFFF',
    highlightColor: '#F97316', // Orange Kinetic
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  mono: {
    preset: 'mono',
    fontFamily: 'Courier New, monospace',
    fontSize: 40,
    primaryColor: '#22D3EE',
    highlightColor: '#FFFFFF',
    strokeColor: '#0B0F17',
    strokeWidth: 4,
    position: 'bottom',
    uppercase: true,
    showEmojis: false,
    animation: 'glow',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  },
  highlight: {
    preset: 'highlight',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 46,
    primaryColor: '#FEF08A',
    highlightColor: '#10B981', // Emerald Highlight
    strokeColor: '#000000',
    strokeWidth: 5,
    position: 'bottom',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  impact: {
    preset: 'impact',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 52,
    primaryColor: '#FFFFFF',
    highlightColor: '#FACC15', // Electric Gold
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  pulse: {
    preset: 'pulse',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 48,
    primaryColor: '#FFFFFF',
    highlightColor: '#22C55E', // Emerald Pulse
    strokeColor: '#000000',
    strokeWidth: 5,
    position: 'bottom',
    uppercase: true,
    showEmojis: true,
    animation: 'bounce',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  clean: {
    preset: 'clean',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 42,
    primaryColor: '#F8FAFC',
    highlightColor: '#38BDF8', // Cyan Highlight
    strokeColor: '#0F172A',
    strokeWidth: 4,
    position: 'bottom',
    uppercase: false,
    showEmojis: false,
    animation: 'karaoke',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  },
  studio: {
    preset: 'studio',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 46,
    primaryColor: '#FFFFFF',
    highlightColor: '#E11D48', // Clipper Crimson
    strokeColor: '#09090B',
    strokeWidth: 5,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  bold: {
    preset: 'bold',
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 50,
    primaryColor: '#FEF08A',
    highlightColor: '#F97316', // Bold Amber
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'bottom',
    uppercase: true,
    showEmojis: true,
    animation: 'bounce',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  minimal: {
    preset: 'minimal',
    fontFamily: 'Inter, sans-serif',
    fontSize: 38,
    primaryColor: '#F8FAFC',
    highlightColor: '#94A3B8',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'bottom',
    uppercase: false,
    showEmojis: false,
    animation: 'glow',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  },
  neon: {
    preset: 'neon',
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 50,
    primaryColor: '#F43F5E',
    highlightColor: '#06B6D4',
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  kendrick: {
    preset: 'kendrick',
    fontFamily: 'Montserrat, Inter, system-ui, sans-serif',
    fontSize: 48,
    primaryColor: '#FFFFFF',
    highlightColor: '#000000',
    badgeColor: '#22C55E', // Neon Green Box
    badgeTextColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 4,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  hormozi: {
    preset: 'hormozi',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 54,
    primaryColor: '#FFFFFF',
    highlightColor: '#FACC15', // Electric Gold
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'bounce',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  adrian: {
    preset: 'adrian',
    fontFamily: 'Inter, sans-serif',
    fontSize: 46,
    primaryColor: '#0F172A',
    highlightColor: '#000000',
    badgeColor: '#FDFBF7', // Cream Box
    badgeTextColor: '#0F172A',
    strokeColor: '#FDFBF7',
    strokeWidth: 2,
    position: 'bottom',
    uppercase: true,
    showEmojis: false,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  },
  nora: {
    preset: 'nora',
    fontFamily: 'Georgia, serif',
    fontSize: 44,
    primaryColor: '#E2E8F0',
    highlightColor: '#FFFFFF',
    strokeColor: '#0F172A',
    strokeWidth: 3,
    position: 'bottom',
    uppercase: false,
    showEmojis: false,
    animation: 'glow',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  },
  benie: {
    preset: 'benie',
    fontFamily: 'Impact, sans-serif',
    fontSize: 52,
    primaryColor: '#FFFFFF',
    highlightColor: '#EF4444', // Crimson Red
    strokeColor: '#000000',
    strokeWidth: 5,
    position: 'bottom',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  dan: {
    preset: 'dan',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 48,
    primaryColor: '#FFFFFF',
    highlightColor: '#000000',
    badgeColor: '#FACC15', // Gold Badge
    badgeTextColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 4,
    position: 'bottom',
    uppercase: true,
    showEmojis: true,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  beast: {
    preset: 'beast',
    fontFamily: 'Arial Black, sans-serif',
    fontSize: 52,
    primaryColor: '#38BDF8', // Cyan
    highlightColor: '#F97316', // Orange
    strokeColor: '#000000',
    strokeWidth: 6,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'bounce',
    language: 'en',
    showDualLanguage: false,
    enableSFX: true
  },
  ella: {
    preset: 'ella',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 46,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFFFFF',
    shadowColor: 'rgba(0,0,0,0.85)',
    shadowBlur: 16,
    strokeColor: '#000000',
    strokeWidth: 4,
    position: 'middle',
    uppercase: true,
    showEmojis: false,
    animation: 'pop',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false
  }
};
