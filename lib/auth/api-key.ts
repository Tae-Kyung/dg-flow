import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

export interface ApiKeyUser {
  keyId: string;
  name: string;
  role: string;
  userId: string | null;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = 'dgf_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export async function validateApiKey(request: Request): Promise<ApiKeyUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const key = authHeader.slice(7);
  if (!key.startsWith('dgf_')) return null;

  const hash = hashApiKey(key);
  const supabase = createServiceRoleClient();

  const { data: apiKey } = await supabase
    .from('dgflow_api_keys')
    .select('id, name, role, user_id, expires_at, rate_limit, is_active')
    .eq('key_hash', hash)
    .single();

  if (!apiKey || !apiKey.is_active) return null;

  // Check expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return null;

  // Rate limiting (1-minute window)
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);
  const windowKey = windowStart.toISOString();

  const { data: rateData } = await supabase
    .from('dgflow_api_rate_limits')
    .select('request_count')
    .eq('key_id', apiKey.id)
    .eq('window_start', windowKey)
    .single();

  if (rateData && rateData.request_count >= apiKey.rate_limit) {
    return null; // Rate limited
  }

  // Upsert rate counter
  await supabase.from('dgflow_api_rate_limits').upsert({
    key_id: apiKey.id,
    window_start: windowKey,
    request_count: (rateData?.request_count || 0) + 1,
  }, { onConflict: 'key_id,window_start' });

  // Update last_used_at
  await supabase.from('dgflow_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKey.id);

  return {
    keyId: apiKey.id,
    name: apiKey.name,
    role: apiKey.role,
    userId: apiKey.user_id,
  };
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function rateLimitedResponse() {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
