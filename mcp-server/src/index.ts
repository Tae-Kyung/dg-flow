#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE_URL = process.env.DGFLOW_API_URL || 'http://localhost:3000/api/v1';
const API_KEY = process.env.DGFLOW_API_KEY || '';

async function apiCall(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(path, API_BASE_URL.endsWith('/') ? API_BASE_URL : API_BASE_URL + '/');
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

const server = new McpServer({
  name: 'dgflow',
  version: '1.0.0',
});

// Tool 1: Get Orders
server.tool(
  'get_orders',
  '주문 목록을 조회합니다. 상태 필터링과 페이지네이션을 지원합니다.',
  {
    status: z.string().optional().describe('주문 상태 필터 (draft, completed, pending_customer, customer_approved, under_review, review_completed, final_approved, erp_completed, work_order_created, in_production, production_completed)'),
    limit: z.number().optional().default(20).describe('조회 건수 (최대 100)'),
    offset: z.number().optional().default(0).describe('시작 위치'),
  },
  async ({ status, limit, offset }) => {
    const result = await apiCall('orders', {
      ...(status && { status }),
      limit: String(limit),
      offset: String(offset),
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 2: Get Order Detail
server.tool(
  'get_order_detail',
  '특정 주문의 상세 정보를 품목 목록과 함께 조회합니다.',
  {
    id: z.string().describe('주문 ID (UUID)'),
  },
  async ({ id }) => {
    const result = await apiCall(`orders/${id}`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 3: Get Work Orders
server.tool(
  'get_work_orders',
  '작업의뢰서 목록을 조회합니다. 상태 필터링과 페이지네이션을 지원합니다.',
  {
    status: z.string().optional().describe('작업의뢰서 상태 필터 (pending, in_progress, completed)'),
    limit: z.number().optional().default(20).describe('조회 건수 (최대 100)'),
    offset: z.number().optional().default(0).describe('시작 위치'),
  },
  async ({ status, limit, offset }) => {
    const result = await apiCall('work-orders', {
      ...(status && { status }),
      limit: String(limit),
      offset: String(offset),
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: Get Work Order Detail
server.tool(
  'get_work_order_detail',
  '특정 작업의뢰서의 상세 정보를 품목, 생산이력, 재단이력, 진행률과 함께 조회합니다.',
  {
    id: z.string().describe('작업의뢰서 ID (UUID)'),
  },
  async ({ id }) => {
    const result = await apiCall(`work-orders/${id}`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 5: Get Dashboard Summary
server.tool(
  'get_dashboard_summary',
  '대시보드 요약 통계를 조회합니다. 전체 작업의뢰서 수, 상태별 건수, 이번 달 수량/면적 등을 포함합니다.',
  {},
  async () => {
    const result = await apiCall('dashboard/summary');
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 6: Get Production Logs
server.tool(
  'get_production_logs',
  '복층유리 생산실적을 조회합니다. 작업의뢰서별 필터링이 가능합니다.',
  {
    work_order_id: z.string().optional().describe('작업의뢰서 ID로 필터링 (UUID)'),
    limit: z.number().optional().default(50).describe('조회 건수 (최대 200)'),
    offset: z.number().optional().default(0).describe('시작 위치'),
  },
  async ({ work_order_id, limit, offset }) => {
    const result = await apiCall('production', {
      ...(work_order_id && { work_order_id }),
      limit: String(limit),
      offset: String(offset),
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 7: Get Cutting Logs
server.tool(
  'get_cutting_logs',
  '재단(절단) 실적을 조회합니다. 작업의뢰서별 필터링이 가능합니다.',
  {
    work_order_id: z.string().optional().describe('작업의뢰서 ID로 필터링 (UUID)'),
    limit: z.number().optional().default(50).describe('조회 건수 (최대 200)'),
    offset: z.number().optional().default(0).describe('시작 위치'),
  },
  async ({ work_order_id, limit, offset }) => {
    const result = await apiCall('cutting', {
      ...(work_order_id && { work_order_id }),
      limit: String(limit),
      offset: String(offset),
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Resource: System Overview
server.resource(
  'system-overview',
  'dgflow://system/overview',
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'text/markdown',
      text: `# DG-Flow - 동일유리 주문관리 시스템

## 시스템 개요
동일유리(주)의 주문→승인→ERP→생산 전체 워크플로우를 디지털화한 웹 시스템입니다.

## 핵심 워크플로우 (14단계)
작성중(draft) → 작성완료(completed) → 고객승인대기(pending_customer) → 고객승인완료(customer_approved)
→ 검토중(under_review) → 검토완료(review_completed) → 최종승인(final_approved)
→ 작업의뢰서 생성(work_order_created) → 생산중(in_production) → 생산완료(production_completed)

## 사용자 역할
- 공사관리부 (construction_mgr): 주문 입력, 본인 주문 관리
- 경영지원팀 (biz_support): 주문 검토, ERP 데이터 생성, 마스터 관리
- 관리자 (admin): 최종 승인/반려
- 생산관리팀 (production_mgr): 생산/재단 실적 입력
- 시스템관리자 (system_admin): 전체 관리 권한

## 주요 데이터
- **주문(Orders)**: 거래처→현장 기반, 품목별 품명/규격/수량/위치정보
- **작업의뢰서(Work Orders)**: 주문 기반 자동 생성 또는 바이투 엑셀 업로드
- **생산실적(Production Logs)**: 복층유리 생산 수량, 주/야간, 호기별
- **재단실적(Cutting Logs)**: 원판 재단 수량, 오도시/주야간 구분

## 면적 계산
가로(mm) × 세로(mm) × 수량 / 1,000,000 = m²
`,
    }],
  })
);

// Start server
async function main() {
  if (!API_KEY) {
    console.error('Warning: DGFLOW_API_KEY is not set. API calls will fail.');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
