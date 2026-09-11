import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { USER_ROLES } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import OrderTrendChart from '@/components/dashboard/OrderTrendChart';
import { format, subDays } from 'date-fns';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  // 모든 쿼리를 병렬 실행 (순차 → 병렬로 로딩 속도 개선)
  const monthStart = new Date();
  monthStart.setDate(1);
  const weekLater = new Date();
  weekLater.setDate(weekLater.getDate() + 7);
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const [
    { data: recentOrders },
    { data: trendOrders },
    { count: totalWorkOrders },
    { data: woStatusCounts },
    { data: urgentWorkOrders },
    { data: monthWorkOrders },
  ] = await Promise.all([
    supabase.from('dgflow_work_orders')
      .select('id, work_order_number, customer_name, site_name, request_date, status, source, order:dgflow_orders(customer:dgflow_customers(short_name), site:dgflow_sites(site_name)), items:dgflow_work_order_items(quantity, area_m2)')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('dgflow_work_orders')
      .select('request_date, items:dgflow_work_order_items(quantity, area_m2)')
      .gte('request_date', thirtyDaysAgo),
    supabase.from('dgflow_work_orders').select('*', { count: 'exact', head: true }),
    supabase.from('dgflow_work_orders').select('status, source'),
    supabase.from('dgflow_work_orders')
      .select('id, work_order_number, customer_name, site_name, delivery_date, status, source, order:dgflow_orders(customer:dgflow_customers(short_name), site:dgflow_sites(site_name))')
      .lte('delivery_date', weekLater.toISOString().split('T')[0])
      .neq('status', 'completed')
      .order('delivery_date').limit(10),
    supabase.from('dgflow_work_orders')
      .select('request_date, items:dgflow_work_order_items(quantity, area_m2)')
      .gte('request_date', monthStart.toISOString().split('T')[0]),
  ]);

  // 이번 달 수량/면적 (작업의뢰서 기준)
  let monthQuantity = 0;
  let monthArea = 0;
  (monthWorkOrders || []).forEach(wo => {
    const items = (wo.items || []) as { quantity: number; area_m2: number }[];
    monthQuantity += items.reduce((s, i) => s + i.quantity, 0);
    monthArea += items.reduce((s, i) => s + Number(i.area_m2 || 0), 0);
  });

  const trendMap = new Map<string, { count: number; quantity: number; area: number }>();
  (trendOrders || []).forEach(wo => {
    const date = wo.request_date;
    const items = (wo.items || []) as { quantity: number; area_m2: number }[];
    const qty = items.reduce((s, i) => s + i.quantity, 0);
    const area = items.reduce((s, i) => s + Number(i.area_m2 || 0), 0);
    const prev = trendMap.get(date) || { count: 0, quantity: 0, area: 0 };
    trendMap.set(date, {
      count: prev.count + 1,
      quantity: prev.quantity + qty,
      area: prev.area + area,
    });
  });
  const trendData = [...trendMap.entries()]
    .map(([date, v]) => ({ date: date.slice(5), ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 거래처별 집계 (작업의뢰서 기준)
  const { data: woItemStats } = await supabase
    .from('dgflow_work_orders')
    .select('customer_name, order:dgflow_orders(customer:dgflow_customers(short_name)), items:dgflow_work_order_items(quantity, area_m2)');

  const customerMap = new Map<string, { count: number; quantity: number; area: number }>();
  (woItemStats || []).forEach(wo => {
    const order = wo.order as unknown as { customer: { short_name: string } } | null;
    const name = order?.customer?.short_name || wo.customer_name || '기타';
    const items = (wo.items || []) as { quantity: number; area_m2: number }[];
    const qty = items.reduce((s, i) => s + i.quantity, 0);
    const area = items.reduce((s, i) => s + Number(i.area_m2 || 0), 0);
    const prev = customerMap.get(name) || { count: 0, quantity: 0, area: 0 };
    customerMap.set(name, {
      count: prev.count + 1,
      quantity: prev.quantity + qty,
      area: prev.area + area,
    });
  });
  const topCustomers = [...customerMap.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5);

  // 작업의뢰서 상태 집계
  const woStatusMap = { pending: 0, in_progress: 0, completed: 0 };
  let woUploadCount = 0;
  (woStatusCounts || []).forEach(wo => {
    if (wo.status in woStatusMap) woStatusMap[wo.status as keyof typeof woStatusMap]++;
    if (wo.source === 'upload') woUploadCount++;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-sm text-gray-500">환영합니다, {user?.name}님 ({user ? USER_ROLES[user.role] : ''})</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">전체 의뢰서</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalWorkOrders || 0}</p><p className="text-xs text-gray-500">건 (바이투 {woUploadCount}건)</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">생산 대기</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-yellow-600">{woStatusMap.pending}</p><p className="text-xs text-gray-500">건</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">생산 진행중</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-600">{woStatusMap.in_progress}</p><p className="text-xs text-gray-500">건</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">생산 완료</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{woStatusMap.completed}</p><p className="text-xs text-gray-500">건</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">이번 달 수량</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{monthQuantity}</p><p className="text-xs text-gray-500">개</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">이번 달 면적</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{monthArea.toFixed(1)}</p><p className="text-xs text-gray-500">m²</p></CardContent>
        </Card>
      </div>

      {/* 추이 차트 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">최근 30일 작업의뢰 추이</CardTitle></CardHeader>
        <CardContent>
          <OrderTrendChart data={trendData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 납기 임박 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">납기 임박 (7일 이내)</CardTitle></CardHeader>
          <CardContent>
            {(!urgentWorkOrders || urgentWorkOrders.length === 0) ? (
              <p className="text-sm text-gray-500 py-4 text-center">임박한 납기가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {urgentWorkOrders.map(wo => {
                  const order = wo.order as unknown as { customer: { short_name: string }; site: { site_name: string } } | null;
                  const customerName = order?.customer?.short_name || wo.customer_name || '-';
                  const siteName = order?.site?.site_name || wo.site_name || '-';
                  return (
                    <Link key={wo.id} href={`/work-orders/${wo.id}`} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
                      <div>
                        <span className="font-medium text-sm">{wo.work_order_number}</span>
                        <span className="text-xs text-gray-500 ml-2">{customerName} · {siteName}</span>
                        {wo.source === 'upload' && <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300 text-[10px] px-1">바이투</Badge>}
                      </div>
                      <Badge variant="destructive" className="text-xs">{wo.delivery_date}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 거래처별 현황 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">거래처별 현황 (수량 Top 5)</CardTitle></CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">데이터가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map(([name, stats]) => (
                  <div key={name} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50">
                    <span className="font-medium text-sm">{name}</span>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{stats.count}건</span>
                      <span>{stats.quantity}개</span>
                      <span>{stats.area.toFixed(1)}m²</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 작업의뢰서 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">최근 작업의뢰서</CardTitle></CardHeader>
        <CardContent>
          {(!recentOrders || recentOrders.length === 0) ? (
            <p className="text-sm text-gray-500 py-4 text-center">작업의뢰서가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(wo => {
                const order = wo.order as unknown as { customer: { short_name: string }; site: { site_name: string } } | null;
                const customerName = order?.customer?.short_name || wo.customer_name || '-';
                const siteName = order?.site?.site_name || wo.site_name || '-';
                const items = (wo.items || []) as { quantity: number; area_m2: number }[];
                const qty = items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);
                const area = items.reduce((s: number, i: { area_m2: number }) => s + Number(i.area_m2 || 0), 0);
                const WO_STATUS: Record<string, string> = { pending: '대기', in_progress: '진행중', completed: '완료' };
                return (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
                    <div>
                      <span className="font-medium text-sm">{wo.work_order_number}</span>
                      <span className="text-xs text-gray-500 ml-2">{customerName} · {siteName}</span>
                      {wo.source === 'upload' && <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300 text-[10px] px-1">바이투</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{qty}개 / {area.toFixed(1)}m²</span>
                      <Badge variant="secondary">{WO_STATUS[wo.status] || wo.status}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
