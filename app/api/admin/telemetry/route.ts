import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET() {
  try {
    const storage = getStorage();
    const projects = await storage.listProjects();
    const renderJobs = await storage.listRenderJobs();
    const telemetry = await storage.getCostTelemetry();

    // Compute actuals vs estimates
    const totalActualCost = telemetry
      .filter((t) => !t.isEstimated)
      .reduce((sum, t) => sum + (t.costInUSD || 0), 0);

    const totalEstimatedCost = telemetry
      .filter((t) => t.isEstimated)
      .reduce((sum, t) => sum + (t.costInUSD || 0), 0);

    const activeRenderingJobs = renderJobs.filter(
      (j) => j.status === 'processing' || j.status === 'queued'
    ).length;

    const completedJobs = renderJobs.filter((j) => j.status === 'completed').length;
    const failedJobs = renderJobs.filter((j) => j.status === 'failed').length;

    return NextResponse.json({
      success: true,
      summary: {
        totalProjects: projects.length,
        totalRenderJobs: renderJobs.length,
        activeRenderingJobs,
        completedJobs,
        failedJobs,
        totalActualCostUSD: parseFloat(totalActualCost.toFixed(4)),
        totalEstimatedCostUSD: parseFloat(totalEstimatedCost.toFixed(4)),
      },
      projects,
      renderJobs,
      telemetry,
    });
  } catch (error: any) {
    console.error('Admin telemetry fetch error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch admin telemetry' },
      { status: 500 }
    );
  }
}
