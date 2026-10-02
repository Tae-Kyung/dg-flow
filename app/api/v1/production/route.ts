import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withApiKey } from '@/lib/api/v1-handler';

export async function GET(request: NextRequest) {
  return withApiKey(request, async () => {
    const supabase = createServiceRoleClient();
    const searchParams = request.nextUrl.searchParams;
    const workOrderId = searchParams.get('work_order_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('dgflow_production_logs')
      .select(`
        id, work_order_id, work_order_item_id, quantity_completed, area_m2, production_date, shift, line_number, log_type, remark, created_at,
        work_order:dgflow_work_orders(work_order_number),
        item:dgflow_work_order_items(product_name, width_mm, height_mm)
      `, { count: 'exact' })
      .order('production_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (workOrderId) query = query.eq('work_order_id', workOrderId);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data, total: count, limit, offset });
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' },
  });
}
