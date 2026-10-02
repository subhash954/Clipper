import { NextRequest, NextResponse } from 'next/server';
import { createBatchJob, executeBatchJob, getBatchJob, estimateBatchCost } from '@/lib/factory/batchService';
import { getOpportunitiesForProject, saveContentAsset } from '@/lib/factory/contentStore';
import { SupportedPlatform } from '@/lib/factory/types';
import { sampleTranscriptWords } from '@/lib/sampleData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      requestedCount = 5,
      maxBudgetUsd = 5.0,
      platforms = ['youtube_shorts', 'tiktok'] as SupportedPlatform[],
      action = 'run', // 'estimate' | 'run'
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (action === 'estimate') {
      const estimate = estimateBatchCost(requestedCount, platforms.length);
      return NextResponse.json({ success: true, estimate });
    }

    // 1. Fetch project opportunities
    const opportunities = await getOpportunitiesForProject(projectId);
    if (opportunities.length === 0) {
      return NextResponse.json({ error: 'No opportunities found for project' }, { status: 400 });
    }

    // 2. Initialize batch job
    const job = createBatchJob(projectId, requestedCount, maxBudgetUsd);

    // 3. Execute batch job
    const { job: completedJob, generatedAssets } = await executeBatchJob(job.id, opportunities, {
      platforms,
      maxBudgetUsd,
      sourceWords: sampleTranscriptWords,
    });

    // 4. Persist generated assets to content store
    for (const asset of generatedAssets) {
      await saveContentAsset(asset);
    }

    return NextResponse.json({
      success: true,
      job: completedJob,
      generatedAssetsCount: generatedAssets.length,
      assets: generatedAssets,
    });
  } catch (err: any) {
    console.error('Batch job error:', err);
    return NextResponse.json({ error: err.message || 'Batch execution failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = getBatchJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch job' }, { status: 500 });
  }
}
