import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withApiKey } from '@/lib/api/v1-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiKey(request, async () => {
    const { id } = await params;
    const supabase = createServiceRoleClient();

    const { data: order, error } = await supabase
      .from('dgflow_orders')
      .select(`
        *,
        customer:dgflow_customers(id, name, short_name, contact_info),
        site:dgflow_sites(id, site_name, address, region_sido, region_sigungu),
        creator:dgflow_users!created_by(id, name, email, role),
        items:dgflow_order_items(id, product_name, width_mm, height_mm, quantity, area_m2, location_dong, location_line, location_floor, location_room, location_type, location_window_type, remark, sort_order)
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Sort items
    if (order.items) {
      (order.items as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order);
    }

    return NextResponse.json({ data: order });
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' },
  });
}
