'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface WorkOrderItem {
  id: string;
  product_name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  produced_quantity: number;
  area_m2: number;
}

export default function ProductionInputPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const workOrderId = params.id as string;

  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [workOrder, setWorkOrder] = useState<{ work_order_number: string } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('dgflow_work_orders').select('work_order_number').eq('id', workOrderId).single()
      .then(({ data }) => setWorkOrder(data));
    supabase.from('dgflow_work_order_items').select('*').eq('work_order_id', workOrderId).order('sort_order')
      .then(({ data }) => setItems(data || []));
  }, [workOrderId]);

  async function handleSave(itemId: string) {
    const qty = parseInt(quantities[itemId] || '0');
    if (qty <= 0) return;

    setSaving(true);
    await fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order_id: workOrderId,
        work_order_item_id: itemId,
        quantity_completed: qty,
        log_type: 'partial',
      }),
    });

    // 새로고침
    const { data } = await supabase.from('dgflow_work_order_items')
      .select('*').eq('work_order_id', workOrderId).order('sort_order');
    setItems(data || []);
    setQuantities(prev => ({ ...prev, [itemId]: '' }));
    setSaving(false);
  }

  async function handleFullComplete(itemId: string, remaining: number) {
    setSaving(true);
    await fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order_id: workOrderId,
        work_order_item_id: itemId,
        quantity_completed: remaining,
        log_type: 'full',
      }),
    });

    const { data } = await supabase.from('dgflow_work_order_items')
      .select('*').eq('work_order_id', workOrderId).order('sort_order');
    setItems(data || []);
    setSaving(false);
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalProduced = items.reduce((s, i) => s + i.produced_quantity, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">생산실적 입력</h1>
          <p className="text-gray-500">의뢰번호: {workOrder?.work_order_number}</p>
        </div>
        <div className="text-sm">
          <span className="text-gray-500">진행률: </span>
          <span className="font-bold">{totalProduced}/{totalQty}</span>
          <span className="text-gray-500"> ({totalQty > 0 ? Math.round(totalProduced / totalQty * 100) : 0}%)</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품명</TableHead>
                <TableHead className="text-right">규격</TableHead>
                <TableHead className="text-right">의뢰수량</TableHead>
                <TableHead className="text-right">완료수량</TableHead>
                <TableHead className="text-right">잔여</TableHead>
                <TableHead>생산입력</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const remaining = item.quantity - item.produced_quantity;
                const isComplete = remaining <= 0;
                return (
                  <TableRow key={item.id} className={isComplete ? 'bg-green-50' : ''}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-right">{item.width_mm}×{item.height_mm}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.produced_quantity}</TableCell>
                    <TableCell className="text-right">
                      {isComplete ? <Badge className="bg-green-100 text-green-800">완료</Badge> : remaining}
                    </TableCell>
                    <TableCell>
                      {!isComplete && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="w-20 h-8 text-sm"
                            placeholder="수량"
                            min={1}
                            max={remaining}
                            value={quantities[item.id] || ''}
                            onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <Button size="sm" variant="outline" onClick={() => handleSave(item.id)} disabled={saving}>
                            부분완료
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!isComplete && (
                        <Button size="sm" onClick={() => handleFullComplete(item.id, remaining)} disabled={saving}>
                          <CheckCircle className="mr-1 h-3 w-3" />전량완료
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => router.push('/production')}>돌아가기</Button>
    </div>
  );
}
