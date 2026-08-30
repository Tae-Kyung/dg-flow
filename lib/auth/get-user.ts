import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DgflowUser } from '@/types/user';

export async function getCurrentUser(): Promise<DgflowUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('dgflow_users')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  return data as DgflowUser | null;
}
