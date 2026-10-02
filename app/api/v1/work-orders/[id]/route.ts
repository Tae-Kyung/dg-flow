import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withApiKey } from '@/lib/api/v1-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiKey(request, async () => {
    const { id } = await params;
    const supabase = createServiceRoleClient();

    const { data: wo, error } = await supabase
      .from('dgflow_work_orders')
      .select(`
        *,
        order:dgflow_orders(id, order_number, customer:dgflow_customers(name, short_name), site:dgflow_sites(site_name)),
        items:dgflow_work_order_items(id, product_name, thickness, width_mm, height_mm, quantity, produced_quantity, area_m2, sort_order)
      `)
      .eq('id', id)
      .single();

    if (error || !wo) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Get production logs
    const { data: productionLogs } = await supabase
      .from('dgflow_production_logs')
      .select('id, work_order_item_id, quantity_completed, area_m2, production_date, shift, line_number, log_type, remark, created_at')
      .eq('work_order_id', id)
      .order('production_date', { ascending: false });

    // Get cutting logs
    const { data: cuttingLogs } = await supabase
      .from('dgflow_cutting_logs')
      .select('id, product_name, quantity, area_m2, cutting_date, shift, raw_glass_type, raw_width_mm, raw_height_mm, raw_quantity, remark, created_at')
      .eq('work_order_id', id)
      .order('cutting_date', { ascending: false });

    // Calculate progress
    const items = (wo.items || []) as any[];
    const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
    const producedQty = items.reduce((s: number, i: any) => s + (i.produced_quantity || 0), 0);
    const progressPercent = totalQty > 0 ? Math.round((producedQty / totalQty) * 100) : 0;

    return NextResponse.json({
      data: {
        ...wo,
        display_customer: wo.order?.customer?.short_name || wo.order?.customer?.name || wo.customer_name || '-',
        display_site: wo.order?.site?.site_name || wo.site_name || '-',
        progress: { totalQuantity: totalQty, producedQuantity: producedQty, percent: progressPercent },
        production_logs: productionLogs || [],
        cutting_logs: cuttingLogs || [],
      },
    });
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' },
  });
}
