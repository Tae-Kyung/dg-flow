export const ORDER_STATUS = {
  draft: '초안',
  pending_customer: '고객승인대기',
  rejected_by_customer: '반려-수정중',
  customer_approved: '고객승인완료',
  under_review: '검토중',
  review_completed: '검토완료',
  pending_approval: '승인대기',
  rejected_by_admin: '반려-재검토',
  final_approved: '최종승인',
  erp_completed: 'ERP입력완료',
  work_order_created: '작업의뢰서생성',
  in_production: '생산중',
  production_completed: '생산완료',
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

// 허용된 상태 전이
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending_customer'],
  pending_customer: ['customer_approved', 'rejected_by_customer'],
  rejected_by_customer: ['pending_customer'],
  customer_approved: ['under_review'],
  under_review: ['review_completed'],
  review_completed: ['pending_approval', 'final_approved', 'rejected_by_admin'],
  pending_approval: ['final_approved', 'rejected_by_admin'],
  rejected_by_admin: ['under_review'],
  final_approved: ['erp_completed'],
  erp_completed: ['work_order_created'],
  work_order_created: ['in_production'],
  in_production: ['production_completed'],
  production_completed: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
