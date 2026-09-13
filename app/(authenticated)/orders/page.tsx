import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ORDER_STATUS, STATUS_COLORS, type OrderStatus } from '@/types/order-status';
import { Plus, Download } from 'lucide-react';
import { hasPermission } from '@/lib/auth/role-guard';
import Pagination from '@/components/ui/pagination';
import OrderSearchFilter from '@/components/order/SearchFilter';
import SortableHeader from '@/components/order/SortableHeader';
import CopyButton from '@/components/order/CopyButton';
import DeliveryDday from '@/components/order/DeliveryDday';

const VALID_PAGE_SIZES = [20, 50, 100];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string; sort?: string; dir?: string; size?: string }> }) {
  const params = await searchParams;
  const pageSizeParam = parseInt(params.size || '20');
  const PAGE_SIZE = VALID_PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : 20;
  const page = parseInt(params.page || '1');
  const offset = (page - 1) * PAGE_SIZE;
  const q = params.q?.trim() || '';
  const statusFilter = params.status || '';
  const sortField = params.sort || 'created_at';
  const sortDir = params.dir === 'asc';

  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('dgflow_orders')
    .select(`
      *,
      customer:dgflow_customers(name, short_name),
      site:dgflow_sites(site_name),
      creator:dgflow_users!created_by(name)
    `, { count: 'exact' });

  // 텍스트 검색: 주문번호로 직접 필터 + 거래처/현장은 ID 목록으로 필터
  if (q) {
    // 거래처 ID 검색
    const { data: matchedCustomers } = await supabase
      .from('dgflow_customers')
      .select('id')
      .or(`name.ilike.%${q}%,short_name.ilike.%${q}%`);
    const customerIds = (matchedCustomers || []).map(c => c.id);

    // 현장 ID 검색
    const { data: matchedSites } = await supabase
      .from('dgflow_sites')
      .select('id')
      .ilike('site_name', `%${q}%`);
    const siteIds = (matchedSites || []).map(s => s.id);

    // 작성자 ID 검색
    const { data: matchedUsers } = await supabase
      .from('dgflow_users')
      .select('id')
      .ilike('name', `%${q}%`);
    const userIds = (matchedUsers || []).map(u => u.id);

    const orConditions = [`order_number.ilike.%${q}%`];
    if (customerIds.length > 0) orConditions.push(`customer_id.in.(${customerIds.join(',')})`);
    if (siteIds.length > 0) orConditions.push(`site_id.in.(${siteIds.join(',')})`);
    if (userIds.length > 0) orConditions.push(`created_by.in.(${userIds.join(',')})`);

    query = query.or(orConditions.join(','));
  }

  // 상태 그룹 필터
  if (statusFilter) {
    const statuses = statusFilter.split(',');
    query = query.in('status', statuses);
  }

  const allowedSorts = ['created_at', 'order_number', 'order_date', 'delivery_date', 'total_quantity', 'total_area_m2'];
  const safeSortField = allowedSorts.includes(sortField) ? sortField : 'created_at';

  const { data: orders, count } = await query
    .order(safeSortField, { ascending: sortDir })
    .range(offset, offset + PAGE_SIZE - 1);

  const totalCount = count || 0;
  const canCreate = user && hasPermission(user.role, 'orders:create');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">주문 관리</h1>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <a href={`/api/orders?format=xlsx&q=${encodeURIComponent(q)}&status=${encodeURIComponent(statusFilter)}`} download>
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-4 w-4" />
                엑셀 다운로드
              </Button>
            </a>
          )}
          {canCreate && (
            <Link href="/orders/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                새 주문
              </Button>
            </Link>
          )}
        </div>
      </div>

      <OrderSearchFilter />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="order_number" currentSort={safeSortField} currentDir={sortDir}>주문번호</SortableHeader>
                <TableHead>거래처</TableHead>
                <TableHead>현장</TableHead>
                <SortableHeader field="order_date" currentSort={safeSortField} currentDir={sortDir}>주문일</SortableHeader>
                <SortableHeader field="delivery_date" currentSort={safeSortField} currentDir={sortDir}>납품일</SortableHeader>
                <SortableHeader field="total_quantity" currentSort={safeSortField} currentDir={sortDir} className="text-right">수량</SortableHeader>
                <SortableHeader field="total_area_m2" currentSort={safeSortField} currentDir={sortDir} className="text-right">면적(m²)</SortableHeader>
                <TableHead>상태</TableHead>
                <TableHead>작성자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!orders || orders.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-[var(--muted-foreground)]">
                    {q || statusFilter ? '검색 결과가 없습니다.' : `주문이 없습니다. ${canCreate ? '새 주문을 생성하세요.' : ''}`}
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, idx) => (
                  <TableRow key={order.id} className={`cursor-pointer hover:bg-[var(--muted)] ${idx % 2 === 1 ? 'bg-[var(--muted)]/30' : ''}`}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/orders/${order.id}`} className="text-[var(--primary)] hover:underline font-medium">
                          {order.order_number || `초안-${order.id.slice(0, 6)}`}
                        </Link>
                        {order.order_number && <CopyButton text={order.order_number} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {(order.customer as { short_name: string })?.short_name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{(order.site as { site_name: string })?.site_name}</TableCell>
                    <TableCell>{order.order_date}</TableCell>
                    <TableCell>
                      {order.delivery_date ? <DeliveryDday date={order.delivery_date} /> : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{order.total_quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{order.total_area_m2}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[order.status as OrderStatus] || ''} rounded-full px-2.5 py-0.5 text-xs`} variant="secondary">
                        {ORDER_STATUS[order.status as OrderStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>{(order.creator as { name: string })?.name}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination totalCount={totalCount} pageSize={PAGE_SIZE} />
    </div>
  );
}
