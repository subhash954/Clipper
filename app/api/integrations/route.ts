import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { PlatformIntegration } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      // In local dev without DB integrations, return disconnected status
      return NextResponse.json({
        success: true,
        integrations: [
          { platform: 'youtube', status: 'disconnected', accountName: null },
          { platform: 'tiktok', status: 'disconnected', accountName: null },
          { platform: 'instagram', status: 'disconnected', accountName: null },
        ],
      });
    }

    const { data, error } = await supabase
      .from('integrations')
      .select('id, platform, account_name, channel_id, status, scopes, token_expires_at, created_at')
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const integrations: PlatformIntegration[] = (data || []).map((row: any) => ({
      id: row.id,
      userId: user.id,
      platform: row.platform,
      accountName: row.account_name,
      channelId: row.channel_id,
      status: row.status,
      scopes: row.scopes || [],
      expiresAt: row.token_expires_at,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ success: true, integrations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
