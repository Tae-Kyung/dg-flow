import { NextResponse } from 'next/server';

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'DG-Flow API',
    description: '동일유리 주문관리 시스템 (DG-Flow) 외부 연동 API. 주문, 작업의뢰서, 생산실적 등 핵심 데이터를 조회할 수 있습니다.',
    version: '1.0.0',
    contact: { name: 'DG-Flow 시스템관리자' },
  },
  servers: [
    { url: '/api/v1', description: 'DG-Flow API v1' },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API Key (dgf_ 접두사). 시스템관리자에게 발급 요청.',
      },
    },
    schemas: {
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          order_number: { type: 'string', nullable: true, example: '261002-1' },
          order_date: { type: 'string', format: 'date' },
          delivery_date: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['draft','completed','pending_customer','customer_approved','rejected_by_customer','under_review','review_completed','pending_approval','rejected_by_admin','final_approved','erp_completed','work_order_created','in_production','production_completed'] },
          total_quantity: { type: 'integer' },
          total_area_m2: { type: 'number' },
          remark: { type: 'string', nullable: true },
          customer: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, short_name: { type: 'string' } } },
          site: { type: 'object', properties: { id: { type: 'string' }, site_name: { type: 'string' } } },
          creator: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
        },
      },
      OrderDetail: {
        allOf: [{ '$ref': '#/components/schemas/Order' }, {
          type: 'object',
          properties: {
            items: { type: 'array', items: { '$ref': '#/components/schemas/OrderItem' } },
          },
        }],
      },
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          product_name: { type: 'string', example: '22T 5CL+12Ar.+5로이' },
          width_mm: { type: 'number' },
          height_mm: { type: 'number' },
          quantity: { type: 'integer' },
          area_m2: { type: 'number' },
          location_dong: { type: 'string', nullable: true },
          location_line: { type: 'string', nullable: true },
          location_floor: { type: 'string', nullable: true },
          remark: { type: 'string', nullable: true },
        },
      },
      WorkOrder: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          work_order_number: { type: 'string', example: '26-0001' },
          display_customer: { type: 'string' },
          display_site: { type: 'string' },
          source: { type: 'string', enum: ['order', 'upload'] },
          request_date: { type: 'string', format: 'date' },
          delivery_date: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
        },
      },
      WorkOrderDetail: {
        allOf: [{ '$ref': '#/components/schemas/WorkOrder' }, {
          type: 'object',
          properties: {
            items: { type: 'array', items: { '$ref': '#/components/schemas/WorkOrderItem' } },
            progress: { type: 'object', properties: { totalQuantity: { type: 'integer' }, producedQuantity: { type: 'integer' }, percent: { type: 'integer' } } },
            production_logs: { type: 'array', items: { '$ref': '#/components/schemas/ProductionLog' } },
            cutting_logs: { type: 'array', items: { '$ref': '#/components/schemas/CuttingLog' } },
          },
        }],
      },
      WorkOrderItem: {
        type: 'object',
        properties: {
          id: { type: 'string' }, product_name: { type: 'string' }, thickness: { type: 'string', nullable: true },
          width_mm: { type: 'number' }, height_mm: { type: 'number' }, quantity: { type: 'integer' },
          produced_quantity: { type: 'integer' }, area_m2: { type: 'number' },
        },
      },
      ProductionLog: {
        type: 'object',
        properties: {
          id: { type: 'string' }, work_order_id: { type: 'string' }, quantity_completed: { type: 'integer' },
          area_m2: { type: 'number' }, production_date: { type: 'string', format: 'date' },
          shift: { type: 'string', nullable: true }, line_number: { type: 'string', nullable: true },
          log_type: { type: 'string', nullable: true },
        },
      },
      CuttingLog: {
        type: 'object',
        properties: {
          id: { type: 'string' }, work_order_id: { type: 'string' }, product_name: { type: 'string' },
          quantity: { type: 'integer' }, area_m2: { type: 'number' },
          cutting_date: { type: 'string', format: 'date' }, shift: { type: 'string', nullable: true },
        },
      },
      DashboardSummary: {
        type: 'object',
        properties: {
          total_work_orders: { type: 'integer' },
          status_counts: { type: 'object', additionalProperties: { type: 'integer' } },
          this_month: { type: 'object', properties: { quantity: { type: 'integer' }, area_m2: { type: 'number' } } },
          source_breakdown: { type: 'object', properties: { order: { type: 'integer' }, upload: { type: 'integer' } } },
          generated_at: { type: 'string', format: 'date-time' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  paths: {
    '/orders': {
      get: {
        operationId: 'getOrders',
        summary: '주문 목록 조회',
        description: '모든 주문을 페이지네이션하여 조회합니다. 상태 필터링이 가능합니다.',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' }, description: '주문 상태 필터' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: '주문 목록', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { '$ref': '#/components/schemas/Order' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } } },
      },
    },
    '/orders/{id}': {
      get: {
        operationId: 'getOrderDetail',
        summary: '주문 상세 조회',
        description: '특정 주문의 상세 정보를 품목 목록과 함께 조회합니다.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: '주문 상세', content: { 'application/json': { schema: { type: 'object', properties: { data: { '$ref': '#/components/schemas/OrderDetail' } } } } } },
          '404': { description: '주문 없음', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/work-orders': {
      get: {
        operationId: 'getWorkOrders',
        summary: '작업의뢰서 목록 조회',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: '작업의뢰서 목록', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { '$ref': '#/components/schemas/WorkOrder' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } } },
      },
    },
    '/work-orders/{id}': {
      get: {
        operationId: 'getWorkOrderDetail',
        summary: '작업의뢰서 상세 조회',
        description: '특정 작업의뢰서의 상세 정보를 품목, 생산이력, 재단이력과 함께 조회합니다.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: '작업의뢰서 상세', content: { 'application/json': { schema: { type: 'object', properties: { data: { '$ref': '#/components/schemas/WorkOrderDetail' } } } } } },
          '404': { description: '작업의뢰서 없음' },
        },
      },
    },
    '/dashboard/summary': {
      get: {
        operationId: 'getDashboardSummary',
        summary: '대시보드 요약 통계',
        description: '작업의뢰서 기준 전체 현황 요약 (상태별 건수, 이번 달 수량/면적 등)',
        responses: { '200': { description: '대시보드 요약', content: { 'application/json': { schema: { type: 'object', properties: { data: { '$ref': '#/components/schemas/DashboardSummary' } } } } } } },
      },
    },
    '/production': {
      get: {
        operationId: 'getProductionLogs',
        summary: '생산실적 조회',
        parameters: [
          { name: 'work_order_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: '작업의뢰서 ID 필터' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: '생산실적 목록', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { '$ref': '#/components/schemas/ProductionLog' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } } },
      },
    },
    '/cutting': {
      get: {
        operationId: 'getCuttingLogs',
        summary: '재단실적 조회',
        parameters: [
          { name: 'work_order_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: '작업의뢰서 ID 필터' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: '재단실적 목록', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { '$ref': '#/components/schemas/CuttingLog' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
