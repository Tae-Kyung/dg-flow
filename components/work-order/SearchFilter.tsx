'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

const WO_STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'pending', label: '대기' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

const SOURCE_OPTIONS = [
  { value: '', label: '전체 구분' },
  { value: 'order', label: '주문' },
  { value: 'upload', label: '바이투' },
];

export default function WorkOrderSearchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const source = searchParams.get('source') || '';
  const hasFilters = q || status || source;

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    params.delete('page'); // 필터 변경 시 1페이지로
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
            placeholder="의뢰번호, 거래처, 현장 검색..."
            defaultValue={q}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">검색</Button>
      </form>
      <select
        value={status}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {WO_STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={source}
        onChange={(e) => updateParams({ source: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {SOURCE_OPTIONS.map(o => (
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
