import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, clientApiKey } = await req.json();
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        isLiveAI: false,
        message: "No Gemini API Key provided. Running local hook engine.",
        viralHooks: [
          {
            title: "The $10,000 Speed Secret",
            score: 98,
            hookReason: "Contrarian hook opening that attacks overthinking.",
            bRollSearchKeywords: ["fast sports car", "stock chart rising", "focused creator"]
          }
        ]
      });
    }

    // Call Real Google Gemini 2.5 Flash API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are an expert short-form video editor for YouTube Shorts and TikTok.
Analyze this video transcript and return a valid JSON array of 3 viral shorts segments.
Each object must have:
- "title": (Punchy high-CTR short title)
- "viralScore": (number between 90 and 99)
- "hookReason": (Why viewers won't skip)
- "bRollSearchKeywords": (3 visual search terms for stock video)

Transcript: "${(transcript || title || 'If you want to build a ten thousand dollar business, stop overthinking and start creating value every single day! Speed wins the game every time.').slice(0, 4000)}"`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = textOutput ? JSON.parse(textOutput) : null;

    return NextResponse.json({
      isLiveAI: true,
      modelUsed: 'gemini-2.5-flash',
      viralHooks: parsed || []
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ isLiveAI: false, error: message }, { status: 500 });
  }
}
