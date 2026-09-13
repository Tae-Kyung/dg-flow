'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/user';
import { USER_ROLES } from '@/types/user';
import { getMenuForRole } from '@/lib/auth/role-guard';
import {
  LayoutDashboard, ClipboardList, FileCheck, CheckCircle,
  Factory, Database, Users, LogOut,
} from 'lucide-react';
import NotificationBell from './NotificationBell';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, ClipboardList, FileCheck, CheckCircle,
  Factory, Database, Users,
};

interface SidebarProps {
  userName: string;
  userRole: UserRole;
}

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const menuItems = getMenuForRole(userRole);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
      <div className="border-b border-[var(--sidebar-border)] px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[var(--font-heading)] font-bold text-[var(--primary)]">DG-Flow</h1>
          <p className="text-xs text-[var(--muted-foreground)]">동일유리 주문관리</p>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {menuItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] px-4 py-3">
        <p className="text-sm font-medium text-[var(--sidebar-foreground)]">{userName}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{USER_ROLES[userRole]}</p>
        <button
          onClick={async () => {
            await fetch('/api/auth/signout', { method: 'POST' });
            window.location.href = '/login';
          }}
          className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] mt-2 transition-colors"
        >
          <LogOut className="h-3 w-3" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
