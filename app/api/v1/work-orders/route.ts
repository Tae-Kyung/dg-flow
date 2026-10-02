import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withApiKey } from '@/lib/api/v1-handler';

export async function GET(request: NextRequest) {
  return withApiKey(request, async () => {
    const supabase = createServiceRoleClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('dgflow_work_orders')
      .select(`
        id, work_order_number, customer_name, site_name, source, request_date, delivery_date, status, created_at,
        order:dgflow_orders(id, order_number, customer:dgflow_customers(name, short_name), site:dgflow_sites(site_name))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Normalize display names
    const normalized = (data || []).map((wo: any) => ({
      ...wo,
      display_customer: wo.order?.customer?.short_name || wo.order?.customer?.name || wo.customer_name || '-',
      display_site: wo.order?.site?.site_name || wo.site_name || '-',
    }));

    return NextResponse.json({ data: normalized, total: count, limit, offset });
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' },
  });
}
