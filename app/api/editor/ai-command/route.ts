import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { parseAIEditCommand } from '@/lib/editor/aiEditCommands';
import { CanonicalRenderSpec } from '@/lib/editor/types';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { projectId, command, renderSpec } = body;

    if (!projectId || !command || !renderSpec) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, command, or renderSpec' },
        { status: 400 }
      );
    }

    await requireProjectAccess(user, projectId, 'editor');

    const plan = parseAIEditCommand(command, renderSpec as CanonicalRenderSpec);
    const updatedSpec = plan.apply(renderSpec as CanonicalRenderSpec);

    return NextResponse.json({
      success: true,
      command: plan.command,
      recognizedIntent: plan.recognizedIntent,
      summary: plan.summary,
      operations: plan.operations,
      updatedSpec,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
