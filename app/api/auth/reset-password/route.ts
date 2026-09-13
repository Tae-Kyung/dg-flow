import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !['system_admin'].includes(currentUser.role)) {
    return NextResponse.json({ error: '시스템관리자만 비밀번호를 초기화할 수 있습니다.' }, { status: 403 });
  }

  const { auth_id, new_password } = await request.json();

  if (!auth_id || !new_password) {
    return NextResponse.json({ error: 'auth_id와 new_password는 필수입니다.' }, { status: 400 });
  }

  if (new_password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { error } = await supabase.auth.admin.updateUserById(auth_id, {
    password: new_password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
