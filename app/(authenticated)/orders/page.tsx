import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ORDER_STATUS, type OrderStatus } from '@/types/order-status';
import { Plus } from 'lucide-react';
import { hasPermission } from '@/lib/auth/role-guard';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_customer: 'bg-yellow-100 text-yellow-800',
  rejected_by_customer: 'bg-red-100 text-red-800',
  customer_approved: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  review_completed: 'bg-indigo-100 text-indigo-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  rejected_by_admin: 'bg-red-100 text-red-800',
  final_approved: 'bg-green-100 text-green-800',
  erp_completed: 'bg-emerald-100 text-emerald-800',
  work_order_created: 'bg-teal-100 text-teal-800',
  in_production: 'bg-cyan-100 text-cyan-800',
  production_completed: 'bg-green-200 text-green-900',
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  const { data: orders } = await supabase
    .from('dgflow_orders')
    .select(`
      *,
      customer:dgflow_customers(name, short_name),
      site:dgflow_sites(site_name),
      creator:dgflow_users!created_by(name)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  const canCreate = user && hasPermission(user.role, 'orders:create');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 관리</h1>
        {canCreate && (
          <Link href="/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              새 주문
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>주문번호</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead>현장</TableHead>
                <TableHead>주문일</TableHead>
                <TableHead>납품일</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">면적(m2)</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>작성자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!orders || orders.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    주문이 없습니다. {canCreate && '새 주문을 생성하세요.'}
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline font-medium">
                        {order.order_number || '-'}
                      </Link>
                    </TableCell>
                    <TableCell>{(order.customer as { short_name: string })?.short_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{(order.site as { site_name: string })?.site_name}</TableCell>
                    <TableCell>{order.order_date}</TableCell>
                    <TableCell>{order.delivery_date || '-'}</TableCell>
                    <TableCell className="text-right">{order.total_quantity}</TableCell>
                    <TableCell className="text-right">{order.total_area_m2}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[order.status] || ''} variant="secondary">
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
    </div>
  );
}
