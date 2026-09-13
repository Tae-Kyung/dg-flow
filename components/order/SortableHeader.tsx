'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TableHead } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  field: string;
  currentSort: string;
  currentDir: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function SortableHeader({ field, currentSort, currentDir, className, children }: SortableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = currentSort === field;

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', field);
    if (isActive) {
      params.set('dir', currentDir ? 'desc' : 'asc');
    } else {
      params.set('dir', 'asc');
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <TableHead className={cn('cursor-pointer select-none hover:bg-[var(--muted)] transition-colors', className)} onClick={handleClick}>
      <div className={cn('flex items-center gap-1', className?.includes('text-right') && 'justify-end')}>
        {children}
        {isActive ? (
          currentDir ? <ArrowUp className="h-3.5 w-3.5 text-[var(--primary)]" /> : <ArrowDown className="h-3.5 w-3.5 text-[var(--primary)]" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-50" />
        )}
      </div>
    </TableHead>
  );
}
