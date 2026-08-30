import { describe, it, expect } from 'vitest';
import { canTransition } from '@/types/order-status';

describe('canTransition', () => {
  it('초안 → 고객승인대기 가능', () => {
    expect(canTransition('draft', 'pending_customer')).toBe(true);
  });

  it('초안 → 최종승인 불가', () => {
    expect(canTransition('draft', 'final_approved')).toBe(false);
  });

  it('고객승인대기 → 고객승인완료 가능', () => {
    expect(canTransition('pending_customer', 'customer_approved')).toBe(true);
  });

  it('고객승인대기 → 반려 가능', () => {
    expect(canTransition('pending_customer', 'rejected_by_customer')).toBe(true);
  });

  it('반려-수정중 → 고객승인대기 가능 (재전송)', () => {
    expect(canTransition('rejected_by_customer', 'pending_customer')).toBe(true);
  });

  it('최종승인 → ERP입력완료 가능', () => {
    expect(canTransition('final_approved', 'erp_completed')).toBe(true);
  });

  it('생산완료 → 어디로도 전이 불가', () => {
    expect(canTransition('production_completed', 'draft')).toBe(false);
  });
});
