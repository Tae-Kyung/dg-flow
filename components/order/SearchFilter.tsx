'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { ORDER_STATUS, type OrderStatus } from '@/types/order-status';

const STATUS_GROUPS = [
  { value: '', label: '전체 상태' },
  { value: 'draft,completed', label: '작성중/작성완료' },
  { value: 'pending_customer,rejected_by_customer,customer_approved', label: '고객승인 단계' },
  { value: 'under_review,review_completed,pending_approval,rejected_by_admin', label: '검토/승인 단계' },
  { value: 'final_approved,erp_completed,work_order_created', label: '승인완료/의뢰서' },
  { value: 'in_production,production_completed', label: '생산 단계' },
];

export default function OrderSearchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') || '';
  const statusGroup = searchParams.get('status') || '';
  const hasFilters = q || statusGroup;

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const clearAll = () => {
    router.push(pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        className="flex items-center gap-2 flex-1 min-w-[200px]"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          updateParams({ q: formData.get('q') as string });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            name="q"
            placeholder="주문번호, 거래처, 현장, 작성자 검색..."
            defaultValue={q}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">검색</Button>
      </form>
      <select
        value={statusGroup}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {STATUS_GROUPS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-gray-500">
          <X className="h-4 w-4 mr-1" />초기화
        </Button>
      )}
    </div>
  );
}
