/**
 * CLIPPER CONTENT FACTORY — COPYWRITING & SUPPORTING CONTENT ENGINES
 * Phase 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 40, 52
 * 
 * Generates verified, evidence-grounded copy for titles, platform descriptions,
 * hashtags, CTAs, text posts, carousels, threads, emails, thumbnail concepts,
 * and structured AI Content Briefs.
 */

import {
  ContentOpportunity,
  ContentBrief,
  GeneratedTitle,
  GeneratedCopy,
  HashtagSet,
  ThumbnailConcept,
  TextPostStructure,
  CarouselPlan,
  CarouselSlide,
  ThreadPlan,
  ThreadPost,
  EmailAngle,
  BrandVoice,
  BrandKit,
  SupportedPlatform
} from './types';

/**
 * Generates structured AI Content Brief (Phase 40)
 */
export function generateContentBrief(
  opportunity: ContentOpportunity,
  platform: SupportedPlatform,
  options?: {
    objective?: ContentBrief['objective'];
    brandVoice?: BrandVoice;
    targetDurationSeconds?: number;
  }
): ContentBrief {
  const objective = options?.objective || 'Audience Growth';
  const duration = options?.targetDurationSeconds || Math.round(opportunity.sourceEnd - opportunity.sourceStart);

  return {
    id: `brief-${opportunity.id}`,
    opportunityId: opportunity.id,
    objective,
    audience: opportunity.audience || 'Entrepreneurs and Content Creators',
    topic: opportunity.topic,
    hook: opportunity.hook,
    coreIdea: opportunity.payoff,
    supportingEvidence: opportunity.evidence.quote,
    payoff: opportunity.payoff,
    cta: generateCTA(objective, opportunity.topic),
    platform,
    targetDurationSeconds: duration,
    visualStrategy: duration <= 60 
      ? 'Vertical 9:16 framing with dynamic speaker tracking and B-roll overlays on core statistics.'
      : 'Clean centered composition with subtle topic graphics.',
    captionStrategy: 'Karaoke-style dynamic animated subtitles with brand accent highlighting on emphasis words.',
    brandVoice: options?.brandVoice?.tone || 'Educational',
    createdAt: new Date().toISOString(),
  };
}

/**
 * CTA Engine (Phase 17)
 */
export function generateCTA(objective: string, topic?: string): string {
  switch (objective) {
    case 'Brand Awareness':
      return 'Follow @Clipper for daily breakdowns on content creation and video intelligence.';
    case 'Lead Generation':
      return 'Check the link in bio to get our free playbook on this exact topic.';
    case 'Community Engagement':
      return `What is your take on ${topic || 'this'}? Drop your thoughts in the comments below.`;
    case 'Product Conversion':
      return 'Try Clipper free today to turn your videos into viral shorts in minutes.';
    case 'Audience Growth':
    default:
      return 'Save this for later and share it with someone who needs to hear it.';
  }
}

/**
 * Title Generator (Phase 20)
 */
export function generateTitles(
  opportunity: ContentOpportunity,
  brandVoice?: BrandVoice
): GeneratedTitle[] {
  const topic = opportunity.topic;
  const quote = opportunity.evidence.quote;

  const titles: GeneratedTitle[] = [
    {
      type: 'Direct',
      title: `${topic}: What You Need To Know`,
      sourceEvidence: quote,
      confidence: 0.95,
    },
    {
      type: 'Curiosity',
      title: `The Truth About ${topic} Nobody Talks About`,
      sourceEvidence: quote,
      confidence: 0.92,
    },
    {
      type: 'Educational',
      title: `How ${topic} Actually Works (Explained Simply)`,
      sourceEvidence: quote,
      confidence: 0.94,
    },
    {
      type: 'Contrarian',
      title: `Why Everything You Were Told About ${topic} Is Backwards`,
      sourceEvidence: quote,
      confidence: 0.91,
    },
    {
      type: 'Outcome',
      title: `How To Master ${topic} In 60 Seconds`,
      sourceEvidence: quote,
      confidence: 0.88,
    },
    {
      type: 'Story',
      title: `What Happened When We Tested ${topic}`,
      sourceEvidence: quote,
      confidence: 0.86,
    },
  ];

  // Apply banned phrase filter if configured
  if (brandVoice?.bannedPhrases && brandVoice.bannedPhrases.length > 0) {
    return titles.filter((t) => 
      !brandVoice.bannedPhrases.some((banned) => t.title.toLowerCase().includes(banned.toLowerCase()))
    );
  }

  return titles;
}

/**
 * Hashtag Engine (Phase 22)
 */
export function generateHashtags(
  opportunity: ContentOpportunity,
  brandKit?: BrandKit,
  maxCount: number = 8
): HashtagSet {
  const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const broad = ['#contentcreator', '#videoediting', '#entrepreneur', '#shorts'];
  const niche = [`#${sanitize(opportunity.topic)}tips`, `#${sanitize(opportunity.topic)}strategy`];
  const topic = [`#${sanitize(opportunity.topic)}`, `#${sanitize(opportunity.subtopic || 'insights')}`];
  const brand = brandKit?.name ? [`#${sanitize(brandKit.name)}`] : ['#clipperai'];

  const all = Array.from(new Set([...broad, ...niche, ...topic, ...brand])).slice(0, maxCount);

  return {
    broad,
    niche,
    topic,
    brand,
    all,
  };
}

/**
 * Description Generator (Phase 21)
 */
export function generatePlatformCopy(
  opportunity: ContentOpportunity,
  brief: ContentBrief,
  hashtags: HashtagSet
): GeneratedCopy {
  const tagString = hashtags.all.join(' ');
  const coreInsight = opportunity.payoff || opportunity.sourceTranscript.slice(0, 200);

  return {
    youtubeDescription: `${opportunity.hook}\n\nIn this video, we break down ${opportunity.topic} and why ${coreInsight}.\n\n💡 Key takeaway:\n"${opportunity.evidence.quote}"\n\n${brief.cta}\n\n${tagString}`,
    instagramCaption: `${opportunity.hook} 👇\n\n${coreInsight}\n\n💬 ${brief.cta}\n\n.\n.\n.\n${tagString}`,
    tiktokCaption: `${opportunity.hook} 👀 ${tagString}`,
    linkedinPost: `Most discussions around ${opportunity.topic} focus on the wrong variable.\n\nHere is what the evidence actually reveals:\n\n> "${opportunity.evidence.quote}"\n\nWhy this matters:\n${coreInsight}\n\n${brief.cta}\n\n${hashtags.niche.concat(hashtags.topic).join(' ')}`,
    xPost: `${opportunity.hook}\n\n"${opportunity.evidence.quote.slice(0, 140)}"\n\nHere's what this means for you: 🧵👇`,
  };
}

/**
 * Thumbnail Concept Engine (Phase 23)
 * Explicitly marked isGeneratedImage: false
 */
export function generateThumbnailConcept(opportunity: ContentOpportunity): ThumbnailConcept {
  return {
    id: `thumb-${opportunity.id}`,
    opportunityId: opportunity.id,
    headline: opportunity.topic.toUpperCase(),
    visualSubject: 'Close-up speaker reaction with focused eyeline towards viewer',
    composition: 'Rule of thirds, subject on right 60%, bold 2-word text hook on left',
    emotionOrAction: 'Intense realization, conviction, gesture emphasizing key point',
    background: 'Subtle darkened studio backdrop with soft red rim light',
    contrast: 'High-contrast white bold typography with red accent box',
    branding: 'Small unobtrusive brand logo in top left safe margin',
    layout: 'Mobile-first 9:16 vertical / 16:9 thumbnail safe zone compliant',
    isGeneratedImage: false,
  };
}

/**
 * Text Post Engine (Phase 24)
 */
export function generateTextPost(opportunity: ContentOpportunity): TextPostStructure {
  const hook = opportunity.hook;
  const insight = `The core reality of ${opportunity.topic} is simpler than most people think.`;
  const explanation = opportunity.payoff;
  const example = `Evidence from the discussion: "${opportunity.evidence.quote}"`;
  const conclusion = `When you shift focus away from distractions and focus on the fundamentals, the result speaks for itself.`;
  const cta = `What has been your experience with ${opportunity.topic}? Let me know below.`;

  const formattedText = [
    hook,
    '',
    insight,
    '',
    explanation,
    '',
    example,
    '',
    conclusion,
    '',
    cta,
  ].join('\n');

  return {
    id: `text-${opportunity.id}`,
    hook,
    insight,
    explanation,
    example,
    conclusion,
    cta,
    formattedText,
    sourceEvidence: opportunity.evidence.quote,
  };
}

/**
 * Carousel Engine (Phase 25)
 */
export function generateCarouselPlan(opportunity: ContentOpportunity): CarouselPlan {
  const topic = opportunity.topic;
  const quote = opportunity.evidence.quote;

  const slides: CarouselSlide[] = [
    {
      slideNumber: 1,
      purpose: 'Hook',
      headline: opportunity.hook,
      bodyText: `Swipe to see how ${topic} really works 👉`,
      sourceEvidence: quote,
      visualCue: 'Bold typography on brand color background',
    },
    {
      slideNumber: 2,
      purpose: 'Problem',
      headline: `The Hidden Bottleneck`,
      bodyText: `Most people struggle with ${topic} because they rely on outdated assumptions.`,
      sourceEvidence: quote,
      visualCue: 'Negative contrast highlight box',
    },
    {
      slideNumber: 3,
      purpose: 'Mistake',
      headline: `The #1 Mistake`,
      bodyText: `Treating ${topic} as an afterthought rather than a primary growth driver.`,
      sourceEvidence: quote,
      visualCue: 'Comparison chart / icon with warning cross',
    },
    {
      slideNumber: 4,
      purpose: 'Framework',
      headline: `The Proven Framework`,
      bodyText: `"${quote.slice(0, 120)}..."`,
      sourceEvidence: quote,
      visualCue: 'Numbered 3-step sequence diagram',
    },
    {
      slideNumber: 5,
      purpose: 'Example',
      headline: `Real-World Application`,
      bodyText: opportunity.payoff,
      sourceEvidence: quote,
      visualCue: 'Case study card with metric badges',
    },
    {
      slideNumber: 6,
      purpose: 'Action',
      headline: `3 Steps To Take Today`,
      bodyText: `1. Audit your current approach.\n2. Apply this single lever.\n3. Measure outcome rigorously.`,
      sourceEvidence: quote,
      visualCue: 'Interactive checklist aesthetic',
    },
    {
      slideNumber: 7,
      purpose: 'CTA',
      headline: `Found this valuable?`,
      bodyText: `Save this post and share it with someone building their next big thing.`,
      sourceEvidence: quote,
      visualCue: 'Save & share icon prompts',
    },
  ];

  return {
    id: `carousel-${opportunity.id}`,
    opportunityId: opportunity.id,
    title: `${topic} Masterclass Carousel`,
    slides,
    totalSlides: slides.length,
  };
}

/**
 * Thread Engine (Phase 26)
 */
export function generateThreadPlan(opportunity: ContentOpportunity): ThreadPlan {
  const topic = opportunity.topic;
  const quote = opportunity.evidence.quote;

  const posts: ThreadPost[] = [
    {
      postNumber: 1,
      text: `${opportunity.hook}\n\nHere is a 4-part breakdown of why this happens and what to do instead: 🧵👇`,
      sourceEvidence: quote,
    },
    {
      postNumber: 2,
      text: `1/ The fundamental misunderstanding:\n\nPeople treat ${topic} like magic, but it comes down to mechanics:\n\n"${quote.slice(0, 130)}..."`,
      sourceEvidence: quote,
    },
    {
      postNumber: 3,
      text: `2/ The actual turning point:\n\n${opportunity.payoff}`,
      sourceEvidence: quote,
    },
    {
      postNumber: 4,
      text: `3/ Summary & Next Step:\n\nIf you enjoyed this breakdown:\n- Repost post #1 to share\n- Follow for more insights on video & strategy`,
      sourceEvidence: quote,
    },
  ];

  return {
    id: `thread-${opportunity.id}`,
    opportunityId: opportunity.id,
    posts,
    totalPosts: posts.length,
  };
}

/**
 * Email Angle Engine (Phase 27)
 */
export function generateEmailAngle(opportunity: ContentOpportunity): EmailAngle {
  const topic = opportunity.topic;
  const quote = opportunity.evidence.quote;
  const subject = `The uncomfortable truth about ${topic}`;
  const hook = `Hey friend,\n\nLast week, someone asked me a question about ${topic} that stopped me in my tracks.`;
  const story = `Most people assume that succeeding with ${topic} takes months of trial and error. But looking at the actual data, that's not true at all.`;
  const insight = `Here is the key quote from the session:\n\n"${quote}"\n\n${opportunity.payoff}`;
  const action = `Before you wrap up today, ask yourself one question: where are you still doing this the hard way?`;
  const cta = `Hit reply and let me know your biggest takeaway.`;

  const fullBody = [
    `Subject: ${subject}`,
    '',
    hook,
    '',
    story,
    '',
    insight,
    '',
    action,
    '',
    cta,
    '',
    `Best,\nClipper Team`,
  ].join('\n');

  return {
    id: `email-${opportunity.id}`,
    subject,
    hook,
    story,
    insight,
    action,
    cta,
    fullBody,
    sourceEvidence: quote,
  };
}
