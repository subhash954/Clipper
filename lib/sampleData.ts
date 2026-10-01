import { WordTimestamp, ViralClip, SubtitleStyle, SubtitleLanguage } from './types';

// High-converting entrepreneur sample video
export const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

// Feature 18: Satisfying split-screen background gameplay (Subway / Parkour / Minecraft loop)
export const SATISFYING_VIDEO_URLS = {
  subway: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  minecraft: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
  gta: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  none: ""
};

// Word-by-word timestamps matching energetic speech
export const SAMPLE_WORDS: WordTimestamp[] = [
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
    "YOU": "VOUS",
    "WANT": "VOULEZ",
    "BUILD": "CONSTRUIRE",
    "DOLLAR": "$10,000,",
    "STOP": "ARRÊTEZ",
    "START": "COMMENCEZ",
    "SPEED": "LA VITESSE",
    "WINS": "GAGNE"
  },
  de: {
    "IF": "WENN",
    "YOU": "DU",
    "WANT": "WILLST",
    "BUILD": "AUFBAUEN",
    "DOLLAR": "$10,000,",
    "STOP": "STOPP",
    "SPEED": "GESCHWINDIGKEIT",
    "WINS": "GEWINNT"
  }
};

// Feature 1: Viral Hooks with Retention Metrics
export const SAMPLE_VIRAL_CLIPS: ViralClip[] = [
  {
    id: "clip-1",
    title: "🔥 The $10,000 Secret Rule",
    hookSummary: "High-energy contrarian opening about speed vs perfection in business.",
    start: 0,
    end: 8.5,
    viralScore: 98,
    tags: ["High Energy", "Strong Hook", "Retention > 88%"],
    hookStrength: 98,
    retentionEstimate: 89,
    energyLevel: 'Extreme'
  },
  {
    id: "clip-2",
    title: "⚡ Speed Over Perfection",
    hookSummary: "Direct psychological punchline revealing why 90% of beginners fail.",
    start: 8.8,
    end: 14.5,
    viralScore: 94,
    tags: ["Mindset", "Motivational", "Shareable"],
    hookStrength: 93,
    retentionEstimate: 84,
    energyLevel: 'High'
  }
];

// Feature 4: Filler words cut demonstration
export const DETECTED_FILLER_WORDS = [
  { word: "Umm", timestamp: "0:04.2", duration: "0.6s" },
  { word: "Uhh", timestamp: "0:08.6", duration: "0.8s" },
  { word: "Silence Pause", timestamp: "0:11.1", duration: "1.1s" }
];

// Feature 5 & 25: AI Generated Titles & Viral Hashtags
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
  { time: 3.4, label: "Peak Passion Face (Score: 98)" },
  { time: 8.0, label: "Confident Hook Stare (Score: 95)" },
  { time: 12.2, label: "Victory Gesture (Score: 91)" }
];

export const PRESET_STYLES: Record<string, SubtitleStyle> = {
  hormozi: {
    preset: 'hormozi',
    fontFamily: 'Impact, sans-serif',
    fontSize: 52,
    primaryColor: '#FFFFFF',
    highlightColor: '#FACC15',
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
  beast: {
    preset: 'beast',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 48,
    primaryColor: '#FFFFFF',
    highlightColor: '#22C55E',
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
  minimal: {
    preset: 'minimal',
    fontFamily: 'Inter, sans-serif',
    fontSize: 40,
    primaryColor: '#F8FAFC',
    highlightColor: '#38BDF8',
    strokeColor: '#0F172A',
    strokeWidth: 4,
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
  }
};
