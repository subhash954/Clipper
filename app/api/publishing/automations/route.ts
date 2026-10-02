/**
 * CLIPPER PUBLISHING API — AUTOMATION RULES
 * GET /api/publishing/automations
 * POST /api/publishing/automations
 * PATCH /api/publishing/automations
 * DELETE /api/publishing/automations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listAutomationRules,
  createAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
} from '@/lib/publishing/automationEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

  const rules = listAutomationRules(workspaceId);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId = 'default-workspace',
      name,
      triggerEvent,
      actionType,
      config = {},
      enabled = true,
    } = body;

    if (!name || !triggerEvent || !actionType) {
      return NextResponse.json(
        { error: 'Missing required rule parameters (name, triggerEvent, actionType).' },
        { status: 400 }
      );
    }

    const rule = createAutomationRule({
      workspaceId,
      name,
      triggerEvent,
      actionType,
      config,
      enabled,
    });

    return NextResponse.json({ success: true, rule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ruleId, workspaceId = 'default-workspace', enabled } = body;

    if (!ruleId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required parameters (ruleId, enabled).' },
        { status: 400 }
      );
    }

    const rule = toggleAutomationRule(ruleId, workspaceId, enabled);
    return NextResponse.json({ success: !!rule, rule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get('ruleId');
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

  if (!ruleId) {
    return NextResponse.json({ error: 'Missing ruleId.' }, { status: 400 });
  }

  const success = deleteAutomationRule(ruleId, workspaceId);
  return NextResponse.json({ success });
}
