'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { STATUS_TRANSITIONS, ORDER_STATUS, type OrderStatus } from '@/types/order-status';
import type { UserRole } from '@/types/user';
import { Send, CheckCircle, XCircle, FileDown } from 'lucide-react';

interface OrderActionsProps {
  orderId: string;
  currentStatus: OrderStatus;
  userRole: UserRole;
}

// 역할별 실행 가능한 상태 전이
const ROLE_ACTIONS: Record<string, OrderStatus[]> = {
  construction_mgr: ['pending_customer'],
  biz_support: ['under_review', 'review_completed', 'erp_completed'],
  admin: ['final_approved', 'rejected_by_admin'],
  system_admin: ['pending_customer', 'under_review', 'review_completed', 'final_approved', 'rejected_by_admin', 'erp_completed'],
};

const ACTION_LABELS: Partial<Record<OrderStatus, { label: string; icon: typeof Send; variant: 'default' | 'destructive' | 'outline' }>> = {
  pending_customer: { label: '고객에게 전송', icon: Send, variant: 'default' },
  customer_approved: { label: '고객 승인', icon: CheckCircle, variant: 'default' },
  rejected_by_customer: { label: '고객 반려', icon: XCircle, variant: 'destructive' },
  under_review: { label: '검토 시작', icon: CheckCircle, variant: 'default' },
  review_completed: { label: '검토 완료', icon: CheckCircle, variant: 'default' },
  final_approved: { label: '최종 승인', icon: CheckCircle, variant: 'default' },
  rejected_by_admin: { label: '반려', icon: XCircle, variant: 'destructive' },
  erp_completed: { label: 'ERP 데이터 생성', icon: FileDown, variant: 'default' },
};

export default function OrderActions({ orderId, currentStatus, userRole }: OrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const possibleTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  const roleActions = ROLE_ACTIONS[userRole] || [];
  const availableActions = possibleTransitions.filter(s => roleActions.includes(s));

  if (availableActions.length === 0) return null;

  async function handleAction(newStatus: OrderStatus) {
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div className="flex gap-3">
      {availableActions.map(status => {
        const action = ACTION_LABELS[status];
        if (!action) return null;
        const Icon = action.icon;
        return (
          <Button
            key={status}
            variant={action.variant}
            onClick={() => handleAction(status)}
            disabled={loading}
          >
            <Icon className="mr-2 h-4 w-4" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
