'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save } from 'lucide-react';
import { calculateArea } from '@/lib/calc/area';

interface OrderItem {
  product_name: string;
  product_id: string;
  width_mm: string;
  height_mm: string;
  quantity: string;
  location_dong: string;
  location_line: string;
  location_floor: string;
  location_room: string;
  location_type: string;
  location_window_type: string;
  remark: string;
}

const emptyItem: OrderItem = {
  product_name: '', product_id: '', width_mm: '', height_mm: '', quantity: '1',
  location_dong: '', location_line: '', location_floor: '',
  location_room: '', location_type: '', location_window_type: '', remark: '',
};

interface Customer { id: string; name: string; short_name: string; }
interface Site { id: string; site_name: string; customer_id: string; }
interface Product { id: string; display_name: string; product_code: string; }

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [remark, setRemark] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 마스터 데이터 로드
  useEffect(() => {
    supabase.from('dgflow_customers').select('id, name, short_name').eq('is_active', true).order('name')
      .then(({ data }) => setCustomers(data || []));
    supabase.from('dgflow_products').select('id, display_name, product_code').eq('is_active', true).order('display_name')
      .then(({ data }) => setProducts(data || []));
  }, []);

  // 기존 주문 데이터 로드
  useEffect(() => {
    async function loadOrder() {
      const { data: order } = await supabase
        .from('dgflow_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) { setError('주문을 찾을 수 없습니다.'); setLoading(false); return; }

      setCustomerId(order.customer_id);
      setSiteId(order.site_id);
      setOrderDate(order.order_date);
      setDeliveryDate(order.delivery_date || '');
      setRemark(order.remark || '');

      const { data: orderItems } = await supabase
        .from('dgflow_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('sort_order');

      if (orderItems && orderItems.length > 0) {
        setItems(orderItems.map(i => ({
          product_name: i.product_name || '',
          product_id: i.product_id || '',
          width_mm: String(i.width_mm),
          height_mm: String(i.height_mm),
          quantity: String(i.quantity),
          location_dong: i.location_dong || '',
          location_line: i.location_line || '',
          location_floor: i.location_floor || '',
          location_room: i.location_room || '',
          location_type: i.location_type || '',
          location_window_type: i.location_window_type || '',
          remark: i.remark || '',
        })));
      }

      setLoading(false);
    }
    loadOrder();
  }, [orderId]);

  // 거래처 변경 시 현장 로드
  useEffect(() => {
    if (customerId) {
      supabase.from('dgflow_sites').select('id, site_name, customer_id')
        .eq('customer_id', customerId).eq('is_active', true).order('site_name')
        .then(({ data }) => setSites(data || []));
    }
  }, [customerId]);

  function updateItem(index: number, field: keyof OrderItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addItem() { setItems(prev => [...prev, { ...emptyItem }]); }
  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find(p => p.id === productId);
    if (product) {
      updateItem(index, 'product_id', productId);
      updateItem(index, 'product_name', product.display_name);
    }
  }

  const totalQuantity = items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
  const totalArea = items.reduce((s, i) =>
    s + calculateArea(parseInt(i.width_mm) || 0, parseInt(i.height_mm) || 0, parseInt(i.quantity) || 0), 0);

  async function handleSave() {
    setError('');
    if (!customerId || !siteId) { setError('거래처와 현장을 선택하세요.'); return; }
    const validItems = items.filter(i => i.product_name && i.width_mm && i.height_mm && i.quantity);
    if (validItems.length === 0) { setError('최소 1개 이상의 품목을 입력하세요.'); return; }

    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        site_id: siteId,
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        remark: remark || null,
        items: validItems.map(i => ({
          product_id: i.product_id || null,
          product_name: i.product_name,
          width_mm: parseInt(i.width_mm),
          height_mm: parseInt(i.height_mm),
          quantity: parseInt(i.quantity),
          location_dong: i.location_dong || null,
          location_line: i.location_line || null,
          location_floor: i.location_floor || null,
          location_room: i.location_room || null,
          location_type: i.location_type || null,
          location_window_type: i.location_window_type || null,
          remark: i.remark || null,
        })),
      }),
    });

    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setError(result.error || '저장에 실패했습니다.'); return; }
    window.location.href = `/orders/${orderId}`;
  }

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">주문 수정</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">기본 정보</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>거래처 *</Label>
            <select className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
              value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">선택</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.short_name || c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>현장 *</Label>
            <select className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
              value={siteId} onChange={e => setSiteId(e.target.value)} disabled={!customerId}>
              <option value="">{customerId ? '선택' : '거래처 먼저 선택'}</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>주문일</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>납품일</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
          <div className="col-span-full space-y-2">
            <Label>비고</Label>
            <Textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">품목 목록</CardTitle>
          <div className="text-sm text-gray-500">
            총 수량: <span className="font-bold">{totalQuantity}</span> | 총 면적: <span className="font-bold">{totalArea.toFixed(2)} m²</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-4">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">품명 *</Label>
                <select className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                  value={item.product_id} onChange={e => { if (e.target.value) selectProduct(idx, e.target.value); }}>
                  <option value="">품명 선택</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">가로(mm)</Label>
                <Input className="h-9 text-sm" type="number" value={item.width_mm} onChange={e => updateItem(idx, 'width_mm', e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">세로(mm)</Label>
                <Input className="h-9 text-sm" type="number" value={item.height_mm} onChange={e => updateItem(idx, 'height_mm', e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">수량</Label>
                <Input className="h-9 text-sm" type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="1" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">면적(m²)</Label>
                <Input className="h-9 text-sm bg-gray-50" readOnly
                  value={calculateArea(parseInt(item.width_mm) || 0, parseInt(item.height_mm) || 0, parseInt(item.quantity) || 0).toFixed(2)} />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">동</Label>
                <Input className="h-9 text-sm" value={item.location_dong} onChange={e => updateItem(idx, 'location_dong', e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">라인</Label>
                <Input className="h-9 text-sm" value={item.location_line} onChange={e => updateItem(idx, 'location_line', e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">층</Label>
                <Input className="h-9 text-sm" value={item.location_floor} onChange={e => updateItem(idx, 'location_floor', e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">위치/타입</Label>
                <Input className="h-9 text-sm" value={item.location_room} onChange={e => updateItem(idx, 'location_room', e.target.value)} />
              </div>
              <div className="col-span-1 flex items-end">
                <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addItem} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> 품목 추가
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? '저장 중...' : '수정 저장'}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/orders/${orderId}`)}>취소</Button>
      </div>
    </div>
  );
}
