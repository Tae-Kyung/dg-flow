'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, CheckCircle } from 'lucide-react';

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
  const [shift, setShift] = useState('day');
  const [lineNumber, setLineNumber] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('dgflow_work_orders').select('work_order_number').eq('id', workOrderId).single()
      .then(({ data }) => setWorkOrder(data));
    loadItems();
  }, [workOrderId]);

  async function loadItems() {
    const { data } = await supabase.from('dgflow_work_order_items')
      .select('*').eq('work_order_id', workOrderId).order('sort_order');
    setItems(data || []);
  }

  // 입력된 항목이 있는지 확인
  const hasInput = Object.values(quantities).some(v => parseInt(v) > 0);

  // 전체 저장
  async function handleSaveAll() {
    const entries = Object.entries(quantities).filter(([_, v]) => parseInt(v) > 0);
    if (entries.length === 0) return;

    setSaving(true);
    for (const [itemId, qty] of entries) {
      await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          work_order_item_id: itemId,
          quantity_completed: parseInt(qty),
          log_type: 'partial',
          shift,
          line_number: parseInt(lineNumber),
        }),
      });
    }

    setQuantities({});
    await loadItems();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // 전량 완료 (잔여 수량 전부)
  async function handleAllComplete() {
    const incompleteItems = items.filter(i => i.quantity - i.produced_quantity > 0);
    if (incompleteItems.length === 0) return;
    if (!confirm(`미완료 ${incompleteItems.length}건을 모두 전량완료 처리하시겠습니까?`)) return;

    setSaving(true);
    for (const item of incompleteItems) {
      const remaining = item.quantity - item.produced_quantity;
      await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          work_order_item_id: item.id,
          quantity_completed: remaining,
          log_type: 'full',
          shift,
          line_number: parseInt(lineNumber),
        }),
      });
    }

    setQuantities({});
    await loadItems();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalProduced = items.reduce((s, i) => s + i.produced_quantity, 0);
  const totalInput = Object.values(quantities).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const progress = totalQty > 0 ? Math.round(totalProduced / totalQty * 100) : 0;
  const incompleteCount = items.filter(i => i.quantity - i.produced_quantity > 0).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">생산실적 입력</h1>
          <p className="text-gray-500">의뢰번호: {workOrder?.work_order_number}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">
            <span className="text-gray-500">진행률: </span>
            <span className="font-bold">{totalProduced}/{totalQty}</span>
            <span className="text-gray-500"> ({progress}%)</span>
          </p>
          {totalInput > 0 && (
            <p className="text-sm text-blue-600 font-medium">입력 대기: {totalInput}건</p>
          )}
        </div>
      </div>

      {/* 공통 옵션 */}
      <Card>
        <CardContent className="py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">주/야간:</span>
            <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={shift} onChange={e => setShift(e.target.value)}>
              <option value="day">주간</option>
              <option value="night">야간</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">호기:</span>
            <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={lineNumber} onChange={e => setLineNumber(e.target.value)}>
              <option value="1">1호기</option>
              <option value="2">2호기</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 품목별 입력 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">품목별 생산량 입력</CardTitle>
          {incompleteCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleAllComplete} disabled={saving}>
              <CheckCircle className="mr-1 h-4 w-4" />미완료 {incompleteCount}건 전량완료
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품명</TableHead>
                <TableHead className="text-right">규격</TableHead>
                <TableHead className="text-right">의뢰</TableHead>
                <TableHead className="text-right">완료</TableHead>
                <TableHead className="text-right">잔여</TableHead>
                <TableHead className="w-28">생산량 입력</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const remaining = item.quantity - item.produced_quantity;
                const isComplete = remaining <= 0;
                return (
                  <TableRow key={item.id} className={isComplete ? 'bg-green-50' : ''}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-right text-sm">{item.width_mm}×{item.height_mm}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.produced_quantity}</TableCell>
                    <TableCell className="text-right">
                      {isComplete ? <Badge className="bg-green-100 text-green-800">완료</Badge> : remaining}
                    </TableCell>
                    <TableCell>
                      {!isComplete && (
                        <Input
                          type="number"
                          className="h-8 w-24 text-sm text-right"
                          placeholder="0"
                          min={0}
                          max={remaining}
                          value={quantities[item.id] || ''}
                          onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 저장 버튼 영역 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSaveAll} disabled={saving || !hasInput} className="min-w-[140px]">
          <Save className="mr-2 h-4 w-4" />
          {saving ? '저장 중...' : `전체 저장 (${totalInput}건)`}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/work-orders/${workOrderId}`)}>
          돌아가기
        </Button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> 저장 완료
          </span>
        )}
      </div>
    </div>
  );
}
