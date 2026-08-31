'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
// 네이티브 select 사용 (@base-ui Select가 value를 그대로 표시하는 문제 회피)
import { Plus, Trash2, Save } from 'lucide-react';
import { calculateArea } from '@/lib/calc/area';
import ExcelUpload from '@/components/order/ExcelUpload';
import type { ParsedOrderItem, ParsedOrderMeta } from '@/lib/parser/excel-order';

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
interface ProductMapping { product_id: string; variant_name: string; }

export default function NewOrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productMappings, setProductMappings] = useState<ProductMapping[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [remark, setRemark] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingSiteName, setPendingSiteName] = useState('');

  useEffect(() => {
    supabase.from('dgflow_customers').select('id, name, short_name').eq('is_active', true).order('name')
      .then(({ data }) => setCustomers(data || []));
    supabase.from('dgflow_products').select('id, display_name, product_code').eq('is_active', true).order('display_name')
      .then(({ data }) => setProducts(data || []));
    supabase.from('dgflow_product_name_mappings').select('product_id, variant_name')
      .then(({ data }) => setProductMappings(data || []));
  }, []);

  useEffect(() => {
    if (customerId) {
      supabase.from('dgflow_sites').select('id, site_name, customer_id')
        .eq('customer_id', customerId).eq('is_active', true).order('site_name')
        .then(({ data }) => {
          const siteList = data || [];
          setSites(siteList);
          // 엑셀에서 파싱된 현장명이 있으면 자동 매칭
          if (pendingSiteName) {
            const matched = siteList.find(s =>
              s.site_name.includes(pendingSiteName) || pendingSiteName.includes(s.site_name)
            );
            if (matched) setSiteId(matched.id);
            setPendingSiteName('');
          } else {
            setSiteId('');
          }
        });
    }
  }, [customerId]);

  function updateItem(index: number, field: keyof OrderItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItems(prev => [...prev, { ...emptyItem }]);
  }

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

  function handleExcelParsed(parsedItems: ParsedOrderItem[], meta: ParsedOrderMeta) {
    console.log('[handleExcelParsed] called with', parsedItems.length, 'items, meta:', meta);
    console.log('[handleExcelParsed] customers loaded:', customers.length, 'products loaded:', products.length, 'mappings loaded:', productMappings.length);

    // site_name에서 거래처 추출 시도 (공사명에 "거래처-현장" 형태가 많음)
    if (!meta.customer_name && meta.site_name) {
      const parts = meta.site_name.split(/[-_]/);
      if (parts.length >= 2) {
        meta.customer_name = parts[0].trim();
      }
    }

    // 기본정보 자동 채움
    if (meta.customer_name) {
      // "극동건설-성남 금토..." → "극동건설"로 분리 후 매칭
      const nameTokens = meta.customer_name.split(/[-_\s]/);
      const matched = customers.find(c => {
        const cName = c.name.replace(/\(주\)|\(유\)|\(사\)/g, '').trim();
        const cShort = (c.short_name || '').trim();
        return nameTokens.some(token =>
          token.length >= 2 && (cName.includes(token) || cShort.includes(token) || token.includes(cName) || token.includes(cShort))
        );
      });
      if (matched) setCustomerId(matched.id);
    }
    if (meta.site_name) setPendingSiteName(meta.site_name);
    if (meta.order_date) setOrderDate(meta.order_date);
    if (meta.delivery_date) setDeliveryDate(meta.delivery_date);
    if (meta.remark) setRemark(meta.remark);

    // 품명 매칭 헬퍼: display_name 직접 매칭 → variant_name 매칭 → 없으면 빈값
    function findProductId(parsedName: string): string {
      if (!parsedName) return '';
      const normalized = parsedName.replace(/\s+/g, '').toUpperCase();
      // 1. display_name 직접 매칭
      const direct = products.find(p => p.display_name === parsedName);
      if (direct) return direct.id;
      // 2. variant_name 매칭
      const mapping = productMappings.find(m =>
        m.variant_name.replace(/\s+/g, '').toUpperCase() === normalized
      );
      if (mapping) return mapping.product_id;
      // 3. 부분 매칭 (품명에 핵심 키워드 포함)
      const partial = productMappings.find(m =>
        normalized.includes(m.variant_name.replace(/\s+/g, '').toUpperCase()) ||
        m.variant_name.replace(/\s+/g, '').toUpperCase().includes(normalized)
      );
      if (partial) return partial.product_id;
      return '';
    }

    // 품목 자동 채움
    const newItems: OrderItem[] = parsedItems.map(p => {
      const productId = findProductId(p.product_name);
      const matchedProduct = products.find(pr => pr.id === productId);
      return {
      product_name: matchedProduct?.display_name || p.product_name,
      product_id: productId,
      width_mm: p.width_mm,
      height_mm: p.height_mm,
      quantity: p.quantity || '1',
      location_dong: p.location_dong,
      location_line: p.location_line,
      location_floor: p.location_floor,
      location_room: p.location_room,
      location_type: p.location_type,
      location_window_type: p.location_window_type,
      remark: p.remark,
    };});
    setItems(newItems.length > 0 ? newItems : [{ ...emptyItem }]);
  }

  async function handleSave() {
    setError('');
    if (!customerId || !siteId) { setError('거래처와 현장을 선택하세요.'); return; }
    const validItems = items.filter(i => i.product_name && i.width_mm && i.height_mm && i.quantity);
    if (validItems.length === 0) { setError('최소 1개 이상의 품목을 입력하세요.'); return; }

    setSaving(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
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
    router.push('/orders');
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">새 주문 생성</h1>
          <p className="text-sm text-gray-500 mt-1">직접 입력하거나, 기존 발주서 엑셀을 업로드하여 자동으로 채울 수 있습니다.</p>
        </div>
        <ExcelUpload onParsed={handleExcelParsed} />
      </div>

      {/* 기본 정보 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">기본 정보</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>거래처 *</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
            >
              <option value="">선택</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.short_name || c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>현장 *</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              disabled={!customerId}
            >
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
            <Textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="비고 사항" rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* 품목 입력 */}
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
                <Label className="text-xs">품명 * {item.product_name && !item.product_id && <span className="text-orange-500">(미매칭)</span>}</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                  value={item.product_id}
                  onChange={e => { if (e.target.value) selectProduct(idx, e.target.value); else updateItem(idx, 'product_id', ''); }}
                >
                  <option value="">{item.product_name || '품명 선택'}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">가로(mm)</Label>
                <Input className="h-9 text-sm" type="number" value={item.width_mm} onChange={e => updateItem(idx, 'width_mm', e.target.value)} placeholder="가로" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">세로(mm)</Label>
                <Input className="h-9 text-sm" type="number" value={item.height_mm} onChange={e => updateItem(idx, 'height_mm', e.target.value)} placeholder="세로" />
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
                <Input className="h-9 text-sm" value={item.location_dong} onChange={e => updateItem(idx, 'location_dong', e.target.value)} placeholder="302" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">라인</Label>
                <Input className="h-9 text-sm" value={item.location_line} onChange={e => updateItem(idx, 'location_line', e.target.value)} placeholder="1" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">층</Label>
                <Input className="h-9 text-sm" value={item.location_floor} onChange={e => updateItem(idx, 'location_floor', e.target.value)} placeholder="1~6" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">위치/타입</Label>
                <Input className="h-9 text-sm" value={item.location_room} onChange={e => updateItem(idx, 'location_room', e.target.value)} placeholder="거실" />
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
          {saving ? '저장 중...' : '초안 저장'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/orders')}>취소</Button>
      </div>
    </div>
  );
}
