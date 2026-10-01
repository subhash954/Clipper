import { WordTimestamp, SubtitleStyle, VisualLayoutSettings } from './types';
import { SAMPLE_TRANSLATIONS } from './sampleData';

const KEYWORD_EMOJIS: Record<string, string> = {
  BUSINESS: '💼',
  DOLLAR: '💰',
  THOUSAND: '💵',
  STOP: '🛑',
  SPEED: '⚡',
  WINS: '🏆',
  GAME: '🎯',
  PERFECTION: '✨',
  VALUE: '💎',
  START: '🚀',
  CREATING: '🎨'
};

export function renderSubtitlesOnCanvas(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  words: WordTimestamp[],
  style: SubtitleStyle,
  visualSettings: VisualLayoutSettings,
  canvasWidth: number,
  canvasHeight: number,
  showFreeWatermark: boolean = false,
  clipStartTime: number = 0
) {
  // Clear previous overlay frame
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const scale = canvasWidth / 1080;

  // 1. Feature 22: Intro Hook Sticker Banner (First 3.5 seconds)
  if (visualSettings.showIntroHook && currentTime <= 3.8 && visualSettings.introHookText) {
    ctx.save();
    const bannerY = canvasHeight * 0.12;
    const bannerHeight = 70 * scale;
    const bannerWidth = canvasWidth * 0.82;
    const bannerX = (canvasWidth - bannerWidth) / 2;

    // Gradient background banner
    ctx.fillStyle = 'rgba(239, 68, 68, 0.92)'; // energetic red
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerWidth, bannerHeight, 16 * scale);
    ctx.fill();

    // Banner Text
    ctx.font = `900 ${Math.round(32 * scale)}px Impact, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(visualSettings.introHookText.toUpperCase(), canvasWidth / 2, bannerY + bannerHeight / 2);
    ctx.restore();
  }

  // 2. Feature 20: Custom Creator Logo / Handle Watermark
  if (visualSettings.showCustomLogo && visualSettings.customLogoText) {
    ctx.save();
    ctx.font = `700 ${Math.round(28 * scale)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;

    let logoX = canvasWidth - 40 * scale;
    let logoY = 60 * scale;
    ctx.textAlign = 'right';

    if (visualSettings.logoPosition === 'top-left') {
      logoX = 40 * scale;
      ctx.textAlign = 'left';
    } else if (visualSettings.logoPosition === 'bottom-right') {
      logoY = canvasHeight - 70 * scale;
    }

    ctx.fillText(visualSettings.customLogoText, logoX, logoY);
    ctx.restore();
  }

  // 3. Feature 19: Dynamic Progress Bar / Countdown Timer
  if (visualSettings.showProgressBar && duration > 0) {
    ctx.save();
    const progressPercent = Math.min(1, Math.max(0, currentTime / duration));
    const barHeight = (visualSettings.progressBarHeight || 8) * scale;
    const barY = canvasHeight - barHeight;

    // Background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, barY, canvasWidth, barHeight);

    // Active progress fill
    ctx.fillStyle = visualSettings.progressBarColor || '#A855F7';
    ctx.shadowColor = visualSettings.progressBarColor || '#A855F7';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, barY, canvasWidth * progressPercent, barHeight);
    ctx.restore();
  }

  // 4. Feature 8, 10, 11, 12: Dynamic Animated Subtitles & Translations
  if (words && words.length > 0) {
    // Convert absolute timestamps to relative clip time if words have absolute time
    const activeIndex = words.findIndex((w) => {
      const wStart = clipStartTime > 0 && w.start >= clipStartTime ? w.start - clipStartTime : w.start;
      const wEnd = clipStartTime > 0 && w.end >= clipStartTime ? w.end - clipStartTime : w.end;
      return currentTime >= wStart && currentTime <= wEnd;
    });

    if (activeIndex !== -1) {
      const currentWord = words[activeIndex];

      // High-retention fast-cut 3-word window
      const windowSize = 3;
      const chunkStart = Math.max(0, activeIndex - Math.floor(activeIndex % windowSize));
      const chunkEnd = Math.min(words.length, chunkStart + windowSize);
      const activeChunk = words.slice(chunkStart, chunkEnd);

      let yPos = canvasHeight * 0.76;
      if (style.position === 'middle') {
        yPos = canvasHeight * 0.5;
      } else if (style.position === 'top') {
        yPos = canvasHeight * 0.24;
      }

      const fontSize = Math.round(style.fontSize * scale);
      ctx.font = `900 ${fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      // Pre-measure chunk
      const wordMeasurements = activeChunk.map(w => {
        const text = style.uppercase ? w.word.toUpperCase() : w.word;
        return {
          wordObj: w,
          text,
          width: ctx.measureText(text + " ").width
        };
      });

      const totalChunkWidth = wordMeasurements.reduce((acc, curr) => acc + curr.width, 0);
      let currentX = (canvasWidth - totalChunkWidth) / 2;

      // Feature 12: Auto-Emoji detection
      let currentEmoji = '';
      if (style.showEmojis) {
        const cleanWord = currentWord.word.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (KEYWORD_EMOJIS[cleanWord]) {
          currentEmoji = KEYWORD_EMOJIS[cleanWord];
        }
      }

      if (currentEmoji) {
        ctx.save();
        const emojiSize = Math.round(fontSize * 1.3);
        ctx.font = `${emojiSize}px sans-serif`;
        ctx.fillText(currentEmoji, canvasWidth / 2, yPos - fontSize * 1.25);
        ctx.restore();
      }

      // Draw primary words
      wordMeasurements.forEach(({ wordObj, text, width }) => {
        const isActive = wordObj === currentWord;
        const wordCenterX = currentX + width / 2;

        ctx.save();

        if (isActive) {
          // Bouncy progress calculation using relative time
          const wStart = clipStartTime > 0 && wordObj.start >= clipStartTime ? wordObj.start - clipStartTime : wordObj.start;
          const wEnd = clipStartTime > 0 && wordObj.end >= clipStartTime ? wordObj.end - clipStartTime : wordObj.end;
          const progress = (currentTime - wStart) / Math.max(0.1, wEnd - wStart);
          const bounce = Math.sin(progress * Math.PI) * 0.15;
          const wordScale = 1.0 + bounce;

          ctx.translate(wordCenterX, yPos);
          ctx.scale(wordScale, wordScale);
          ctx.translate(-wordCenterX, -yPos);

          ctx.strokeStyle = style.strokeColor;
          ctx.lineWidth = style.strokeWidth * scale * 2.2;
          ctx.strokeText(text, wordCenterX, yPos);

          ctx.fillStyle = style.highlightColor;
          ctx.fillText(text, wordCenterX, yPos);

          if (style.animation === 'glow') {
            ctx.shadowColor = style.highlightColor;
            ctx.shadowBlur = 18 * scale;
            ctx.fillText(text, wordCenterX, yPos);
          }
        } else {
          ctx.strokeStyle = style.strokeColor;
          ctx.lineWidth = style.strokeWidth * scale * 1.8;
          ctx.strokeText(text, wordCenterX, yPos);

          ctx.fillStyle = style.primaryColor;
          ctx.fillText(text, wordCenterX, yPos);
        }

        ctx.restore();
        currentX += width;
      });

      // Feature 10 & 11: Dual-Language Translated Subtitles Stacked Below
      if (style.showDualLanguage && style.language !== 'en') {
        const transDict = SAMPLE_TRANSLATIONS[style.language] || {};
        const cleanWord = currentWord.word.replace(/[^a-zA-Z]/g, '').toUpperCase();
        const translated = transDict[cleanWord] || transDict[currentWord.word] || '';

        if (translated) {
          ctx.save();
          const subFontSize = Math.round(fontSize * 0.62);
          ctx.font = `700 ${subFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Background pill for translated word
          const transWidth = ctx.measureText(translated).width + 30 * scale;
          const transY = yPos + fontSize * 0.95;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.beginPath();
          ctx.roundRect((canvasWidth - transWidth) / 2, transY - (subFontSize * 0.7), transWidth, subFontSize * 1.5, 8 * scale);
          ctx.fill();

          ctx.fillStyle = '#38BDF8'; // cyan translation
          ctx.fillText(translated, canvasWidth / 2, transY);
          ctx.restore();
        }
      }
    }
  }

  // 5. Free Watermark for Non-Pro Users
  if (showFreeWatermark) {
    ctx.save();
    ctx.font = `600 ${Math.round(24 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillText('⚡ Created with ClipStudio.ai', canvasWidth / 2, canvasHeight - (55 * scale));
    ctx.restore();
  }
}
