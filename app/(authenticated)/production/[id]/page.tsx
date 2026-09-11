'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, CheckCircle, ChevronDown, ChevronRight, Pencil, Trash2, X, History } from 'lucide-react';

interface WorkOrderItem {
  id: string;
  product_name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  produced_quantity: number;
  area_m2: number;
}

interface ProductionLog {
  id: string;
  work_order_item_id: string;
  production_date: string;
  quantity_completed: number;
  area_m2: number;
  shift: string;
  line_number: number;
  log_type: string;
  remark: string | null;
  product_name?: string;
  width_mm?: number;
  height_mm?: number;
}

export default function ProductionInputPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const workOrderId = params.id as string;

  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [workOrder, setWorkOrder] = useState<{ work_order_number: string } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('day');
  const [lineNumber, setLineNumber] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 로그 관련
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editReason, setEditReason] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [changeHistory, setChangeHistory] = useState<{ id: string; action: string; old_quantity: number; new_quantity: number | null; reason: string; changed_at: string; changer: { name: string } | null; item: { product_name: string; width_mm: number; height_mm: number } | null }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.from('dgflow_work_orders').select('work_order_number').eq('id', workOrderId).single()
      .then(({ data }) => setWorkOrder(data));
    loadItems();
    loadLogs();
    loadHistory();
  }, [workOrderId]);

  async function loadItems() {
    const { data } = await supabase.from('dgflow_work_order_items')
      .select('*').eq('work_order_id', workOrderId).order('sort_order');
    setItems(data || []);
  }

  async function loadLogs() {
    const { data } = await supabase
      .from('dgflow_production_logs')
      .select('id, work_order_item_id, production_date, quantity_completed, area_m2, shift, line_number, log_type, remark')
      .eq('work_order_id', workOrderId)
      .order('production_date', { ascending: false });
    setLogs(data || []);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('dgflow_production_log_history')
      .select('id, action, old_quantity, new_quantity, reason, changed_at, changer:dgflow_users!left!changed_by(name), item:dgflow_work_order_items!left!work_order_item_id(product_name, width_mm, height_mm)')
      .eq('work_order_id', workOrderId)
      .order('changed_at', { ascending: false });
    setChangeHistory((data || []) as unknown as typeof changeHistory);
  }

  // 일별 집계
  const dailyMap = new Map<string, { total_qty: number; total_area: number; count: number; shifts: Set<string> }>();
  logs.forEach(log => {
    const d = log.production_date;
    const prev = dailyMap.get(d) || { total_qty: 0, total_area: 0, count: 0, shifts: new Set<string>() };
    prev.total_qty += log.quantity_completed;
    prev.total_area += Number(log.area_m2 || 0);
    prev.count += 1;
    prev.shifts.add(`${log.shift === 'night' ? '야' : '주'}간 ${log.line_number}호기`);
    dailyMap.set(d, prev);
  });
  const dailyLogs = [...dailyMap.entries()].map(([date, v]) => ({
    date, total_qty: v.total_qty, total_area: Math.round(v.total_area * 100) / 100,
    count: v.count, shifts: [...v.shifts].join(', '),
  }));

  // 품목 이름 매핑
  const itemMap = new Map(items.map(i => [i.id, i]));

  const hasInput = Object.values(quantities).some(v => parseInt(v) > 0);

  // 전체 저장
  async function handleSaveAll() {
    const entries = Object.entries(quantities).filter(([_, v]) => parseInt(v) > 0);
    if (entries.length === 0) return;

    setSaving(true);
    let hasError = false;
    for (const [itemId, qty] of entries) {
      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          work_order_item_id: itemId,
          quantity_completed: parseInt(qty),
          production_date: productionDate,
          log_type: 'partial',
          shift,
          line_number: parseInt(lineNumber),
        }),
      });
      if (!res.ok) {
        console.error('생산실적 저장 실패:', await res.json().catch(() => ({})));
        hasError = true;
      }
    }

    setQuantities({});
    await loadItems();
    await loadLogs();
    setSaving(false);
    if (hasError) {
      alert('일부 항목 저장에 실패했습니다. 다시 시도해주세요.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  // 전량 완료
  async function handleAllComplete() {
    const incompleteItems = items.filter(i => i.quantity - i.produced_quantity > 0);
    if (incompleteItems.length === 0) return;
    if (!confirm(`미완료 ${incompleteItems.length}건을 모두 전량완료 처리하시겠습니까?`)) return;

    setSaving(true);
    let hasError = false;
    for (const item of incompleteItems) {
      const remaining = item.quantity - item.produced_quantity;
      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          work_order_item_id: item.id,
          quantity_completed: remaining,
          production_date: productionDate,
          log_type: 'full',
          shift,
          line_number: parseInt(lineNumber),
        }),
      });
      if (!res.ok) {
        console.error('전량완료 저장 실패:', await res.json().catch(() => ({})));
        hasError = true;
      }
    }

    setQuantities({});
    await loadItems();
    await loadLogs();
    setSaving(false);
    if (hasError) {
      alert('일부 항목 저장에 실패했습니다. 다시 시도해주세요.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  // 수정 저장
  async function handleEditSave(logId: string) {
    const qty = parseInt(editQuantity);
    if (isNaN(qty) || qty <= 0) { alert('수량은 1 이상이어야 합니다. 취소하려면 삭제를 사용하세요.'); return; }
    if (!editReason.trim()) { alert('수정 사유를 입력해주세요.'); return; }

    setSaving(true);
    const res = await fetch('/api/production', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId, quantity_completed: qty, reason: editReason.trim() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || '수정에 실패했습니다.');
    } else {
      setEditingLog(null);
      setEditQuantity('');
      setEditReason('');
      await loadItems();
      await loadLogs();
      await loadHistory();
    }
    setSaving(false);
  }

  // 삭제 실행
  async function handleDelete(logId: string) {
    if (!deleteReason.trim()) { alert('삭제 사유를 입력해주세요.'); return; }

    setSaving(true);
    const res = await fetch('/api/production', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId, reason: deleteReason.trim() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || '삭제에 실패했습니다.');
    } else {
      setDeleteConfirm(null);
      setDeleteReason('');
      await loadItems();
      await loadLogs();
      await loadHistory();
    }
    setSaving(false);
  }

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
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
            <span className="text-sm text-gray-600">생산일자:</span>
            <Input type="date" className="h-8 w-40 text-sm" value={productionDate} onChange={e => setProductionDate(e.target.value)} />
          </div>
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
                    <TableCell className="text-right text-sm">{item.width_mm}x{item.height_mm}</TableCell>
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

      {/* 일별 생산 이력 */}
      {dailyLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">일별 생산 이력</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>생산일</TableHead>
                  <TableHead className="text-right">생산 수량</TableHead>
                  <TableHead className="text-right">면적(m2)</TableHead>
                  <TableHead className="text-right">건수</TableHead>
                  <TableHead>구분</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyLogs.map(day => {
                  const isExpanded = expandedDates.has(day.date);
                  const dayLogs = logs.filter(l => l.production_date === day.date);
                  return (
                    <>
                      <TableRow key={day.date} className="cursor-pointer hover:bg-gray-50" onClick={() => toggleDate(day.date)}>
                        <TableCell className="px-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        </TableCell>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell className="text-right">{day.total_qty}</TableCell>
                        <TableCell className="text-right">{day.total_area.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{day.count}</TableCell>
                        <TableCell className="text-xs text-gray-500">{day.shifts}</TableCell>
                      </TableRow>
                      {isExpanded && dayLogs.map(log => {
                        const item = itemMap.get(log.work_order_item_id);
                        const isEditing = editingLog === log.id;
                        const isDeleting = deleteConfirm === log.id;

                        return (
                          <TableRow key={log.id} className="bg-gray-50/50">
                            <TableCell></TableCell>
                            <TableCell colSpan={5}>
                              {isEditing ? (
                                <div className="flex flex-col gap-2 py-1">
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-gray-600">{item?.product_name || '-'}</span>
                                    <span className="text-gray-400">{item ? `${item.width_mm}x${item.height_mm}` : ''}</span>
                                    <span className="text-gray-400">{log.shift === 'night' ? '야간' : '주간'} {log.line_number}호기</span>
                                    <span className="text-gray-500">현재: {log.quantity_completed}개</span>
                                    <Input
                                      type="number"
                                      className="h-7 w-20 text-sm text-right"
                                      value={editQuantity}
                                      onChange={e => setEditQuantity(e.target.value)}
                                      min={1}
                                      placeholder="수정 수량"
                                      autoFocus
                                    />
                                    <span className="text-sm text-gray-500">개</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      className="h-7 text-sm flex-1"
                                      placeholder="수정 사유 (필수)"
                                      value={editReason}
                                      onChange={e => setEditReason(e.target.value)}
                                    />
                                    <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleEditSave(log.id)} disabled={saving}>
                                      저장
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingLog(null); setEditReason(''); }}>
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : isDeleting ? (
                                <div className="flex flex-col gap-2 py-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-red-600 font-medium">삭제 확인:</span>
                                    <span>{item?.product_name || '-'} {log.quantity_completed}개</span>
                                    <span className="text-gray-400">({log.shift === 'night' ? '야간' : '주간'} {log.line_number}호기)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      className="h-7 text-sm flex-1"
                                      placeholder="삭제 사유 (필수)"
                                      value={deleteReason}
                                      onChange={e => setDeleteReason(e.target.value)}
                                      autoFocus
                                    />
                                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(log.id)} disabled={saving}>
                                      삭제
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDeleteConfirm(null); setDeleteReason(''); }}>
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between py-1">
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="font-medium">{item?.product_name || '-'}</span>
                                    <span className="text-gray-400">{item ? `${item.width_mm}x${item.height_mm}` : ''}</span>
                                    <span>{log.quantity_completed}개</span>
                                    <span className="text-gray-400">{Number(log.area_m2).toFixed(2)}m2</span>
                                    <span className="text-gray-400">{log.shift === 'night' ? '야간' : '주간'} {log.line_number}호기</span>
                                    {log.remark && <span className="text-gray-400 text-xs">({log.remark})</span>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                                      onClick={(e) => { e.stopPropagation(); setEditingLog(log.id); setEditQuantity(String(log.quantity_completed)); setEditReason(''); setDeleteConfirm(null); }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(log.id); setDeleteReason(''); setEditingLog(null); }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
                <TableRow className="font-bold bg-gray-50">
                  <TableCell></TableCell>
                  <TableCell>합계</TableCell>
                  <TableCell className="text-right">{dailyLogs.reduce((s, l) => s + l.total_qty, 0)}</TableCell>
                  <TableCell className="text-right">{dailyLogs.reduce((s, l) => s + l.total_area, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{dailyLogs.reduce((s, l) => s + l.count, 0)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 수정/삭제 이력 */}
      {changeHistory.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />변경 이력
              <Badge variant="secondary" className="ml-1">{changeHistory.length}건</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? '접기' : '펼치기'}
            </Button>
          </CardHeader>
          {showHistory && (
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일시</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead>변경 내용</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>변경자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeHistory.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {new Date(h.changed_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        {h.action === 'update'
                          ? <Badge variant="secondary" className="bg-blue-50 text-blue-700">수정</Badge>
                          : <Badge variant="secondary" className="bg-red-50 text-red-700">삭제</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{h.item?.product_name || '-'}</span>
                        {h.item && <span className="text-gray-400 ml-1 text-xs">{h.item.width_mm}x{h.item.height_mm}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {h.action === 'update'
                          ? <span>{h.old_quantity}개 <span className="text-gray-400 mx-1">&rarr;</span> <span className="font-medium">{h.new_quantity}개</span></span>
                          : <span className="text-red-600">{h.old_quantity}개 삭제</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{h.reason}</TableCell>
                      <TableCell className="text-sm">{h.changer?.name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
