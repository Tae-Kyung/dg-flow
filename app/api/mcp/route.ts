import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

// --- API Key validation (inline, lightweight) ---
async function validateBearerKey(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const key = authHeader.slice(7);
  if (!key.startsWith('dgf_')) return false;

  const hash = createHash('sha256').update(key).digest('hex');
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('dgflow_api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', hash)
    .single();

  if (!data || !data.is_active) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

// --- Supabase helper ---
function db() {
  return createServiceRoleClient();
}

// --- Create MCP server with tools ---
function createMcpServer() {
  const server = new McpServer({
    name: 'dgflow',
    version: '1.0.0',
  });

  server.tool(
    'get_orders',
    '주문 목록을 조회합니다. 상태 필터링과 페이지네이션을 지원합니다.',
    {
      status: z.string().optional().describe('주문 상태 필터 (draft, completed, pending_customer, customer_approved, under_review, review_completed, final_approved, work_order_created, in_production, production_completed)'),
      limit: z.number().optional().default(20).describe('조회 건수 (최대 100)'),
      offset: z.number().optional().default(0).describe('시작 위치'),
    },
    async ({ status, limit, offset }) => {
      let query = db()
        .from('dgflow_orders')
        .select(`id, order_number, order_date, delivery_date, status, total_quantity, total_area_m2, remark, created_at,
          customer:dgflow_customers(id, name, short_name),
          site:dgflow_sites(id, site_name),
          creator:dgflow_users!created_by(id, name)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Math.min(limit, 100) - 1);
      if (status) query = query.eq('status', status);
      const { data, count, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ data, total: count, limit, offset }, null, 2) }] };
    }
  );

  server.tool(
    'get_order_detail',
    '특정 주문의 상세 정보를 품목 목록과 함께 조회합니다.',
    { id: z.string().describe('주문 ID (UUID)') },
    async ({ id }) => {
      const { data: order, error } = await db()
        .from('dgflow_orders')
        .select(`*, customer:dgflow_customers(id, name, short_name), site:dgflow_sites(id, site_name), creator:dgflow_users!created_by(id, name)`)
        .eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      const { data: items } = await db().from('dgflow_order_items').select('*').eq('order_id', id).order('sort_order');
      return { content: [{ type: 'text' as const, text: JSON.stringify({ data: { ...order, items } }, null, 2) }] };
    }
  );

  server.tool(
    'get_work_orders',
    '작업의뢰서 목록을 조회합니다. 상태 필터링과 페이지네이션을 지원합니다.',
    {
      status: z.string().optional().describe('작업의뢰서 상태 필터 (pending, in_progress, completed)'),
      limit: z.number().optional().default(20).describe('조회 건수 (최대 100)'),
      offset: z.number().optional().default(0).describe('시작 위치'),
    },
    async ({ status, limit, offset }) => {
      let query = db()
        .from('dgflow_work_orders')
        .select(`id, work_order_number, customer_name, site_name, source, request_date, delivery_date, status, created_at,
          order:dgflow_orders(id, site:dgflow_sites(site_name), customer:dgflow_customers(name, short_name), order_number)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Math.min(limit, 100) - 1);
      if (status) query = query.eq('status', status);
      const { data, count, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const enriched = (data || []).map((wo: Record<string, unknown>) => {
        const order = wo.order as Record<string, unknown> | null;
        return {
          ...wo,
          display_customer: wo.customer_name || (order?.customer as Record<string, unknown>)?.short_name || (order?.customer as Record<string, unknown>)?.name || '',
          display_site: wo.site_name || (order?.site as Record<string, unknown>)?.site_name || '',
        };
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ data: enriched, total: count, limit, offset }, null, 2) }] };
    }
  );

  server.tool(
    'get_work_order_detail',
    '특정 작업의뢰서의 상세 정보를 품목, 생산이력, 재단이력, 진행률과 함께 조회합니다.',
    { id: z.string().describe('작업의뢰서 ID (UUID)') },
    async ({ id }) => {
      const { data: wo, error } = await db().from('dgflow_work_orders').select('*').eq('id', id).single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      const [items, prodLogs, cutLogs] = await Promise.all([
        db().from('dgflow_work_order_items').select('*').eq('work_order_id', id).order('sort_order'),
        db().from('dgflow_production_logs').select('*').eq('work_order_id', id).order('production_date', { ascending: false }),
        db().from('dgflow_cutting_logs').select('*').eq('work_order_id', id).order('cutting_date', { ascending: false }),
      ]);
      const totalQty = (items.data || []).reduce((s: number, i: Record<string, unknown>) => s + ((i.quantity as number) || 0), 0);
      const producedQty = (items.data || []).reduce((s: number, i: Record<string, unknown>) => s + ((i.produced_quantity as number) || 0), 0);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          data: { ...wo, items: items.data, production_logs: prodLogs.data, cutting_logs: cutLogs.data,
            progress: { totalQuantity: totalQty, producedQuantity: producedQty, percent: totalQty > 0 ? Math.round(producedQty / totalQty * 100) : 0 } }
        }, null, 2) }],
      };
    }
  );

  server.tool(
    'get_dashboard_summary',
    '대시보드 요약 통계를 조회합니다. 전체 작업의뢰서 수, 상태별 건수, 이번 달 수량/면적 등을 포함합니다.',
    {},
    async () => {
      const supabase = db();
      const [total, pending, inProgress, completed, monthItems] = await Promise.all([
        supabase.from('dgflow_work_orders').select('id', { count: 'exact', head: true }),
        supabase.from('dgflow_work_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('dgflow_work_orders').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('dgflow_work_orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('dgflow_work_order_items').select('quantity, area_m2, work_order:dgflow_work_orders!inner(created_at)')
          .gte('work_order.created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);
      const monthQty = (monthItems.data || []).reduce((s: number, i: Record<string, unknown>) => s + ((i.quantity as number) || 0), 0);
      const monthArea = (monthItems.data || []).reduce((s: number, i: Record<string, unknown>) => s + ((i.area_m2 as number) || 0), 0);
      const [orderSource, uploadSource] = await Promise.all([
        supabase.from('dgflow_work_orders').select('id', { count: 'exact', head: true }).eq('source', 'order'),
        supabase.from('dgflow_work_orders').select('id', { count: 'exact', head: true }).eq('source', 'upload'),
      ]);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ data: {
          total_work_orders: total.count || 0,
          status_counts: { pending: pending.count || 0, in_progress: inProgress.count || 0, completed: completed.count || 0 },
          this_month: { quantity: monthQty, area_m2: Math.round(monthArea * 100) / 100 },
          source_breakdown: { order: orderSource.count || 0, upload: uploadSource.count || 0 },
          generated_at: new Date().toISOString(),
        } }, null, 2) }],
      };
    }
  );

  server.tool(
    'get_production_logs',
    '복층유리 생산실적을 조회합니다. 작업의뢰서별 필터링이 가능합니다.',
    {
      work_order_id: z.string().optional().describe('작업의뢰서 ID로 필터링 (UUID)'),
      limit: z.number().optional().default(50).describe('조회 건수 (최대 200)'),
      offset: z.number().optional().default(0).describe('시작 위치'),
    },
    async ({ work_order_id, limit, offset }) => {
      let query = db().from('dgflow_production_logs').select('*', { count: 'exact' })
        .order('production_date', { ascending: false }).range(offset, offset + Math.min(limit, 200) - 1);
      if (work_order_id) query = query.eq('work_order_id', work_order_id);
      const { data, count, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ data, total: count, limit, offset }, null, 2) }] };
    }
  );

  server.tool(
    'get_cutting_logs',
    '재단(절단) 실적을 조회합니다. 작업의뢰서별 필터링이 가능합니다.',
    {
      work_order_id: z.string().optional().describe('작업의뢰서 ID로 필터링 (UUID)'),
      limit: z.number().optional().default(50).describe('조회 건수 (최대 200)'),
      offset: z.number().optional().default(0).describe('시작 위치'),
    },
    async ({ work_order_id, limit, offset }) => {
      let query = db().from('dgflow_cutting_logs').select('*', { count: 'exact' })
        .order('cutting_date', { ascending: false }).range(offset, offset + Math.min(limit, 200) - 1);
      if (work_order_id) query = query.eq('work_order_id', work_order_id);
      const { data, count, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ data, total: count, limit, offset }, null, 2) }] };
    }
  );

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

  return server;
}

// --- Stateless handler: create fresh transport per request ---
async function handleMcpRequest(request: Request): Promise<Response> {
  // Auth check
  const isValid = await validateBearerKey(request);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  const server = createMcpServer();
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
    await transport.close();
  }
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
    },
  });
}
