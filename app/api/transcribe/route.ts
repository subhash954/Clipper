import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { audioUrl } = await req.json();
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        isLiveTranscription: false,
        message: "No Deepgram key configured. Using local transcription timestamps."
      });
    }

    // Call Real Deepgram Nova-2 API
    const targetUrl = audioUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true&words=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: targetUrl })
      }
    );

    const data = await response.json();
    const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    const mappedWords = words.map((w: { word: string; start: number; end: number }) => ({
      word: w.word.toUpperCase(),
      start: parseFloat(w.start.toFixed(2)),
      end: parseFloat(w.end.toFixed(2))
    }));

    return NextResponse.json({
      isLiveTranscription: true,
      provider: "deepgram_nova_2",
      account: "subhashy197@gmail.com",
      transcript,
      wordsCount: mappedWords.length,
      words: mappedWords
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ isLiveTranscription: false, error: message }, { status: 500 });
  }
}
