/**
 * CLIPPER PUBLISHING API — SOCIAL CONNECTIONS
 * GET /api/publishing/connections
 * POST /api/publishing/connections
 * DELETE /api/publishing/connections?id=...
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listConnections,
  connectSocialAccount,
  disconnectAccount,
} from '@/lib/publishing/connectionStore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

  const connections = listConnections(workspaceId);
  return NextResponse.json({ connections });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId = 'default-workspace',
      platform,
      accountId,
      accountName,
      accountHandle,
      rawAccessToken,
      rawRefreshToken,
      expiresInSeconds,
      scopes,
    } = body;

    if (!platform || !accountId || !rawAccessToken) {
      return NextResponse.json(
        { error: 'Missing required connection parameters (platform, accountId, rawAccessToken).' },
        { status: 400 }
      );
    }

    const connection = connectSocialAccount({
      workspaceId,
      platform,
      accountId,
      accountName: accountName || accountHandle || 'Connected Channel',
      accountHandle: accountHandle || accountId,
      rawAccessToken,
      rawRefreshToken,
      expiresInSeconds: expiresInSeconds || 86400, // 24h default
      scopes: scopes || ['upload', 'publish'],
    });

    return NextResponse.json({ success: true, connection });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

  if (!id) {
    return NextResponse.json({ error: 'Missing connection id parameter.' }, { status: 400 });
  }

  const success = disconnectAccount(id, workspaceId);
  return NextResponse.json({ success });
}
