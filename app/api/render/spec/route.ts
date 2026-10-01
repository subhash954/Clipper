import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { CanonicalRenderSpec } from '@/lib/editor/types';
import { validateRenderSpec, compileRenderSpecToClipOptions } from '@/lib/editor/renderSpecCompiler';
import { createRenderJob, startRenderWorkerAsync } from '@/lib/renderJobs';
import { validateSafeRemoteUrl } from '@/lib/security/ssrfValidator';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { spec } = body;

    if (!spec) {
      return NextResponse.json({ error: 'Missing CanonicalRenderSpec object' }, { status: 400 });
    }

    const renderSpec = spec as CanonicalRenderSpec;

    if (renderSpec.projectId) {
      await requireProjectAccess(user, renderSpec.projectId, 'editor');
    }

    // 1. Validate RenderSpec structure and timings (Phase 37)
    const validation = validateRenderSpec(renderSpec);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'RenderSpec validation failed',
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    // 2. Validate media source against SSRF if remote URL
    const sourceUrl = renderSpec.sourceAsset.url;
    if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
      const ssrfCheck = await validateSafeRemoteUrl(sourceUrl);
      if (!ssrfCheck.isValid) {
        return NextResponse.json(
          { error: `Source media URL security violation: ${ssrfCheck.error}` },
          { status: 400 }
        );
      }
    }

    // 3. Compile RenderSpec into execution options
    const clipOptions = compileRenderSpecToClipOptions(renderSpec);

    // 4. Register RenderJob in queue
    const job = await createRenderJob({
      projectId: renderSpec.projectId,
      userId: user.id,
      inputUrl: sourceUrl,
    });

    // 5. Start background worker
    startRenderWorkerAsync(job.id, clipOptions);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      message: 'Render job queued successfully from CanonicalRenderSpec.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
