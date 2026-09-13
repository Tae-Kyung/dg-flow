'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  totalCount: number;
  pageSize?: number;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function Pagination({ totalCount, pageSize = 20 }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1');
  const totalPages = Math.ceil(totalCount / pageSize);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key === 'size') params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  if (totalCount === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  // 표시할 페이지 번호 계산 (현재 페이지 중심으로 최대 5개)
  const pages: number[] = [];
  const s = Math.max(1, currentPage - 2);
  const e = Math.min(totalPages, s + 4);
  for (let i = s; i <= e; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-[var(--muted-foreground)]">
          총 <span className="font-semibold text-[var(--foreground)]">{totalCount}</span>건 중 {start}-{end}건
        </p>
        <select
          value={pageSize}
          onChange={(e) => updateParam('size', e.target.value)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--muted-foreground)]"
        >
          {PAGE_SIZE_OPTIONS.map(s => (
            <option key={s} value={s}>{s}개씩</option>
          ))}
        </select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => updateParam('page', String(currentPage - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map(p => (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'outline'}
              size="sm"
              className="w-9"
              onClick={() => updateParam('page', String(p))}
            >
              {p}
            </Button>
          ))}
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => updateParam('page', String(currentPage + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
