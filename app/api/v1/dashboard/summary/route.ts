import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withApiKey } from '@/lib/api/v1-handler';

export async function GET(request: NextRequest) {
  return withApiKey(request, async () => {
    const supabase = createServiceRoleClient();

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const [
      { count: totalWorkOrders },
      { data: allWo },
      { data: monthWo },
    ] = await Promise.all([
      supabase.from('dgflow_work_orders').select('*', { count: 'exact', head: true }),
      supabase.from('dgflow_work_orders').select('status, source'),
      supabase.from('dgflow_work_orders')
        .select('items:dgflow_work_order_items(quantity, area_m2)')
        .gte('request_date', monthStartStr),
    ]);

    // Status counts
    const statusCounts: Record<string, number> = {};
    (allWo || []).forEach((wo: any) => {
      statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1;
    });

    // This month totals
    let monthQuantity = 0;
    let monthArea = 0;
    (monthWo || []).forEach((wo: any) => {
      const items = (wo.items || []) as { quantity: number; area_m2: number }[];
      monthQuantity += items.reduce((s, i) => s + i.quantity, 0);
      monthArea += items.reduce((s, i) => s + Number(i.area_m2 || 0), 0);
    });

    // Source breakdown
    const sourceBreakdown = { order: 0, upload: 0 };
    (allWo || []).forEach((wo: any) => {
      if (wo.source === 'upload') sourceBreakdown.upload++;
      else sourceBreakdown.order++;
    });

    return NextResponse.json({
      data: {
        total_work_orders: totalWorkOrders || 0,
        status_counts: statusCounts,
        this_month: {
          quantity: monthQuantity,
          area_m2: Math.round(monthArea * 100) / 100,
        },
        source_breakdown: sourceBreakdown,
        generated_at: new Date().toISOString(),
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
