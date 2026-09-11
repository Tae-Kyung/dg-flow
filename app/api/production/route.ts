import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { NextRequest, NextResponse } from 'next/server';

// POST: 생산실적 입력
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { work_order_id, work_order_item_id, quantity_completed, production_date, log_type, shift, line_number, remark } = await request.json();

  const supabase = createServiceRoleClient();

  const area = await calculateItemArea(supabase, work_order_item_id, quantity_completed);

  const { data, error } = await supabase
    .from('dgflow_production_logs')
    .insert({
      work_order_id,
      work_order_item_id,
      production_date: production_date || new Date().toISOString().split('T')[0],
      log_type: log_type || 'full',
      quantity_completed,
      area_m2: area,
      shift: shift || 'day',
      line_number: line_number || 1,
      remark,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // produced_quantity 재계산
  if (work_order_item_id) {
    await recalcProducedQuantity(supabase, work_order_item_id);
  }

  return NextResponse.json({ data }, { status: 201 });
}

// PUT: 생산실적 수정
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, quantity_completed, shift, line_number, reason } = await request.json();

  if (!id || !reason) {
    return NextResponse.json({ error: '수정 사유는 필수입니다.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // 기존 로그 조회
  const { data: oldLog, error: fetchErr } = await supabase
    .from('dgflow_production_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !oldLog) {
    return NextResponse.json({ error: '생산실적을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 변경이력 저장
  await supabase.from('dgflow_production_log_history').insert({
    production_log_id: id,
    action: 'update',
    old_quantity: oldLog.quantity_completed,
    new_quantity: quantity_completed,
    old_shift: oldLog.shift,
    new_shift: shift ?? oldLog.shift,
    old_line_number: oldLog.line_number,
    new_line_number: line_number ?? oldLog.line_number,
    reason,
    changed_by: user.id,
  });

  // 면적 재계산
  const newArea = await calculateItemArea(supabase, oldLog.work_order_item_id, quantity_completed);

  // 로그 업데이트
  const { data, error } = await supabase
    .from('dgflow_production_logs')
    .update({
      quantity_completed,
      area_m2: newArea,
      shift: shift ?? oldLog.shift,
      line_number: line_number ?? oldLog.line_number,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // produced_quantity 재계산
  await recalcProducedQuantity(supabase, oldLog.work_order_item_id);

  return NextResponse.json({ data });
}

// DELETE: 생산실적 삭제
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, reason } = await request.json();

  if (!id || !reason) {
    return NextResponse.json({ error: '삭제 사유는 필수입니다.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // 기존 로그 조회
  const { data: oldLog, error: fetchErr } = await supabase
    .from('dgflow_production_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !oldLog) {
    return NextResponse.json({ error: '생산실적을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 변경이력 저장
  await supabase.from('dgflow_production_log_history').insert({
    production_log_id: id,
    action: 'delete',
    old_quantity: oldLog.quantity_completed,
    new_quantity: null,
    old_shift: oldLog.shift,
    old_line_number: oldLog.line_number,
    reason,
    changed_by: user.id,
  });

  // 로그 삭제
  const { error } = await supabase
    .from('dgflow_production_logs')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // produced_quantity 재계산
  await recalcProducedQuantity(supabase, oldLog.work_order_item_id);

  return NextResponse.json({ success: true });
}

// 품목의 produced_quantity를 로그 합계로 재계산
async function recalcProducedQuantity(supabase: ReturnType<typeof createServiceRoleClient>, itemId: string) {
  if (!itemId) return;

  const { data: logs } = await supabase
    .from('dgflow_production_logs')
    .select('quantity_completed')
    .eq('work_order_item_id', itemId);

  const total = (logs || []).reduce((sum, l) => sum + l.quantity_completed, 0);

  await supabase
    .from('dgflow_work_order_items')
    .update({ produced_quantity: total })
    .eq('id', itemId);
}

async function calculateItemArea(supabase: ReturnType<typeof createServiceRoleClient>, itemId: string, quantity: number): Promise<number> {
  if (!itemId) return 0;
  const { data } = await supabase
    .from('dgflow_work_order_items')
    .select('width_mm, height_mm')
    .eq('id', itemId)
    .single();
  if (!data) return 0;
  return Math.round(data.width_mm * data.height_mm * quantity / 1_000_000 * 100) / 100;
}
