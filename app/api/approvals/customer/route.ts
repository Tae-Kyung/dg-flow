import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { token, order_id, action, comment } = await request.json();
  const supabase = createServiceRoleClient();

  // 토큰 사용 처리
  const { error: tokenError } = await supabase
    .from('dgflow_approval_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null);

  if (tokenError) {
    return NextResponse.json({ error: '토큰 처리 실패' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'customer_approved' : 'rejected_by_customer';

  // 주문 상태 변경
  await supabase.from('dgflow_orders').update({ status: newStatus }).eq('id', order_id);

  // 승인 이력
  await supabase.from('dgflow_approvals').insert({
    order_id,
    step: 'customer',
    status: action === 'approve' ? 'approved' : 'rejected',
    comment: comment || null,
  });

  // 상태 로그
  await supabase.from('dgflow_order_status_logs').insert({
    order_id,
    from_status: 'pending_customer',
    to_status: newStatus,
    comment: comment || (action === 'approve' ? '고객 승인' : '고객 반려'),
  });

  return NextResponse.json({ success: true });
}
