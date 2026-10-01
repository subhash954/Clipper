export interface DocumentaryChapter {
  id: string;
  title: string;
  timestamp: string;
  factVerification: string;
  sourceCitation: string;
  motionGraphicType: 'animated_map' | 'growth_chart' | 'newspaper_headline' | 'historical_quote';
  soundDesign: string;
}

export interface CostCalculation {
  deepgramSTTCost: number;
  geminiFlashLLMCost: number;
  stockBRollCost: number;
  fluxImageGenCost: number;
  ffmpegRenderCost: number;
  r2StorageCost: number;
  totalCostUSD: number;
  totalCostINR: number;
}

/**
 * AI Documentary Structural Blueprint Generator
 * Generates an editorial storyboard structure with recommended research citations.
 */
export function generateDocumentaryBlueprint(topic: string): {
  chapters: DocumentaryChapter[];
  totalFactsVerified: number;
  motionGraphicsCount: number;
  productionCostUSD: number;
} {
  return {
    totalFactsVerified: 0, // Unverified structural blueprint
    motionGraphicsCount: 8,
    productionCostUSD: 1.15,
    chapters: [
      {
        id: "doc-1",
        title: "Act I: The Forgotten Origins",
        timestamp: "0:00 - 4:20",
        factVerification: "Structural Blueprint: Opening narrative establishing founding origins and initial context.",
        sourceCitation: "Recommended research: Primary founder interviews and original archives",
        motionGraphicType: "animated_map",
        soundDesign: "Cinematic Sub-Bass Riser + Archival Film Reel Whir"
      },
      {
        id: "doc-2",
        title: "Act II: The Exponential Spike",
        timestamp: "4:20 - 11:45",
        factVerification: "Structural Blueprint: Core inflection point examining rapid adoption and growth milestones.",
        sourceCitation: "Recommended research: Audited annual metrics and industry benchmark reports",
        motionGraphicType: "growth_chart",
        soundDesign: "Ticking Watch Clockwork + Digital Keyboard Data Taps"
      },
      {
        id: "doc-3",
        title: "Act III: The Controversy & Headline Shock",
        timestamp: "11:45 - 16:30",
        factVerification: "Structural Blueprint: Dramatic tension addressing critical obstacles, controversies, and pushback.",
        sourceCitation: "Recommended research: Public record filings and investigative journalism accounts",
        motionGraphicType: "newspaper_headline",
        soundDesign: "Camera Shutter Blast + Low Tension Strings"
      },
      {
        id: "doc-4",
        title: "Act IV: The Future Paradigm",
        timestamp: "16:30 - 20:00",
        factVerification: "Structural Blueprint: Resolution exploring broader cultural and technological implications.",
        sourceCitation: "Recommended research: Domain specialist commentary and forward-looking publications",
        motionGraphicType: "historical_quote",
        soundDesign: "Epic Orchestral Swell + Resonant Finale Chime"
      }
    ]
  };
}
