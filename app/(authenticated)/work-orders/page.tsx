import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import Pagination from '@/components/ui/pagination';
import WorkOrderUploadButton from '@/components/work-order/UploadButton';
import WorkOrderSearchFilter from '@/components/work-order/SearchFilter';

const WO_STATUS: Record<string, string> = { pending: '대기', in_progress: '진행중', completed: '완료' };
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};
const PAGE_SIZE = 20;

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string; source?: string }> }) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const offset = (page - 1) * PAGE_SIZE;
  const q = params.q?.trim() || '';
  const statusFilter = params.status || '';
  const sourceFilter = params.source || '';

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('dgflow_work_orders')
    .select(`*, order:dgflow_orders(order_number, customer:dgflow_customers(short_name), site:dgflow_sites(site_name)), items:dgflow_work_order_items(quantity, produced_quantity)`, { count: 'exact' });

  // 텍스트 검색: 의뢰번호, 거래처명, 현장명
  if (q) {
    query = query.or(`work_order_number.ilike.%${q}%,customer_name.ilike.%${q}%,site_name.ilike.%${q}%`);
  }

  // 상태 필터
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // 구분 필터
  if (sourceFilter === 'upload') {
    query = query.eq('source', 'upload');
  } else if (sourceFilter === 'order') {
    query = query.or('source.is.null,source.neq.upload');
  }

  const { data: workOrders, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">작업의뢰서</h1>
        <WorkOrderUploadButton />
      </div>
      <WorkOrderSearchFilter />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>의뢰번호</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead>현장</TableHead>
                <TableHead>납품일</TableHead>
                <TableHead>진행률</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>구분</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!workOrders || workOrders.length === 0) ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {q || statusFilter || sourceFilter ? '검색 결과가 없습니다.' : '작업의뢰서가 없습니다.'}
                </TableCell></TableRow>
              ) : workOrders.map(wo => {
                const order = wo.order as { order_number: string; customer: { short_name: string }; site: { site_name: string } } | null;
                const customerName = order?.customer?.short_name || wo.customer_name || '-';
                const siteName = order?.site?.site_name || wo.site_name || '-';
                const isUpload = wo.source === 'upload';
                const items = (wo.items || []) as { quantity: number; produced_quantity: number }[];
                const totalQty = items.reduce((s, i) => s + i.quantity, 0);
                const producedQty = items.reduce((s, i) => s + i.produced_quantity, 0);
                const progress = totalQty > 0 ? Math.round(producedQty / totalQty * 100) : 0;
                return (
                  <TableRow key={wo.id}>
                    <TableCell className="font-medium">{wo.work_order_number}</TableCell>
                    <TableCell>{customerName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{siteName}</TableCell>
                    <TableCell>{wo.delivery_date || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 w-14">{producedQty}/{totalQty}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLORS[wo.status] || ''} variant="secondary">{WO_STATUS[wo.status]}</Badge></TableCell>
                    <TableCell>
                      {isUpload
                        ? <Badge variant="outline" className="text-orange-600 border-orange-300">바이투</Badge>
                        : <Badge variant="outline" className="text-blue-600 border-blue-300">주문</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline text-sm font-medium">상세</Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination totalCount={count || 0} pageSize={PAGE_SIZE} />
    </div>
  );
}
