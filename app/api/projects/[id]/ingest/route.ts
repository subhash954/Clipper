import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getStorage } from '@/lib/storage';
import { getAuthenticatedUser, requireProjectAccess } from '@/lib/auth/serverAuth';
import { extractAudioFromVideo } from '@/lib/media/audioExtraction';
import { transcribeWithDeepgram } from '@/lib/providers/deepgramProvider';
import { analyzeTranscriptWithGemini } from '@/lib/providers/geminiProvider';
import { alignClipsToTranscript } from '@/lib/alignmentEngine';
import { ViralClip, Project } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { id: projectId } = await params;
    await requireProjectAccess(user, projectId, 'editor');

    const storage = getStorage();
    const project = await storage.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: `Project not found: ${projectId}` }, { status: 404 });
    }

    // Determine clip count
    const body = await req.json().catch(() => ({}));
    const clipCount = Math.min(10, Math.max(3, Number(body.clipCount) || 5));

    if (project.sourceType === 'upload') {
      // 1. Resolve source video file
      const sourceUrl = project.sourceUrl || '';
      let videoDiskPath = '';

      if (sourceUrl.startsWith('/uploads/')) {
        videoDiskPath = path.join(process.cwd(), 'public', sourceUrl);
      } else if (fs.existsSync(/*turbopackIgnore: true*/ sourceUrl)) {
        videoDiskPath = sourceUrl;
      }

      if (!videoDiskPath || !fs.existsSync(/*turbopackIgnore: true*/ videoDiskPath)) {
        return NextResponse.json(
          { error: `Source video file not found on disk at: ${sourceUrl}` },
          { status: 400 }
        );
      }

      // 2. Extract 16kHz mono audio via FFmpeg
      const extraction = await extractAudioFromVideo(videoDiskPath);
      if (!extraction.success || !fs.existsSync(extraction.audioPath)) {
        return NextResponse.json(
          { error: `Audio extraction failed: ${extraction.error}` },
          { status: 500 }
        );
      }

      // 3. Transcribe with Deepgram Nova-2
      const audioBuffer = fs.readFileSync(extraction.audioPath);
      const transcript = await transcribeWithDeepgram({
        audioBuffer,
        mimetype: 'audio/mp3',
      });

      // Cleanup temporary extracted audio
      try {
        fs.unlinkSync(extraction.audioPath);
      } catch (e) {
        // non-fatal
      }

      if (!transcript.words || transcript.words.length === 0) {
        return NextResponse.json(
          { error: 'No verbal speech detected in uploaded video.' },
          { status: 422 }
        );
      }

      // 4. Run Gemini Editorial Intelligence on authentic transcript
      const candidateMoments = await analyzeTranscriptWithGemini({
        videoTitle: project.title,
        channelName: project.channelName || 'Creator',
        transcriptText: transcript.text,
        targetClipCount: clipCount,
      });

      // 5. Align candidate moments against authentic word timestamps
      const totalDuration = project.durationSeconds || (transcript.words[transcript.words.length - 1]?.end ?? 60);
      const generatedClips = alignClipsToTranscript({
        candidates: candidateMoments,
        transcript,
        totalDurationSeconds: totalDuration,
      });

      // Attach UUIDs and video media URL
      const finalClips: ViralClip[] = generatedClips.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        videoUrl: project.sourceUrl,
        thumbnailUrl: project.thumbnailUrl,
      }));

      // Calculate unit economics
      const durationMinutes = parseFloat((totalDuration / 60).toFixed(1));
      const deepgramSTTCost = parseFloat((durationMinutes * 0.0043).toFixed(4));
      const geminiFlashLLMCost = parseFloat(((transcript.text.length / 4 / 1000000) * 0.075).toFixed(4));
      const totalCostUSD = parseFloat((deepgramSTTCost + geminiFlashLLMCost).toFixed(3));
      const totalCostINR = Math.round(totalCostUSD * 86.5);

      // 6. Update and persist project
      project.status = 'clips_ready';
      project.transcript = transcript;
      project.clips = finalClips;
      project.clipsCount = finalClips.length;
      project.isMediaAvailable = true;
      project.costs = {
        deepgramSTTCost,
        geminiFlashLLMCost,
        stockBRollCost: 0,
        fluxImageGenCost: 0,
        ffmpegRenderCost: 0,
        r2StorageCost: 0.015,
        totalCostUSD,
        totalCostINR,
      };
      project.updatedAt = new Date().toISOString();

      await storage.saveProject(project);

      return NextResponse.json({
        success: true,
        project,
      });
    }

    return NextResponse.json(
      { error: `Ingestion for sourceType "${project.sourceType}" is handled via /api/youtube/ingest.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Project ingestion pipeline error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in project ingestion pipeline.' },
      { status: 500 }
    );
  }
}
