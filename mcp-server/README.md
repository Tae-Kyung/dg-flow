# DG-Flow MCP Server

동일유리 주문관리 시스템(DG-Flow)의 MCP(Model Context Protocol) 서버입니다.
Claude Desktop, Gemini, ChatGPT 등 AI 어시스턴트에서 DG-Flow 데이터를 조회할 수 있습니다.

## 설치

```bash
cd mcp-server
npm install
npm run build
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| DGFLOW_API_URL | DG-Flow API v1 base URL | http://localhost:3000/api/v1 |
| DGFLOW_API_KEY | API Key (dgf_ 접두사) | (필수) |

## Claude Desktop 설정

`claude_desktop_config.json`에 아래를 추가하세요:

```json
{
  "mcpServers": {
    "dgflow": {
      "command": "node",
      "args": ["D:/DATA2/dongil-ax/mcp-server/dist/index.js"],
      "env": {
        "DGFLOW_API_URL": "https://your-domain.vercel.app/api/v1",
        "DGFLOW_API_KEY": "dgf_your_api_key_here"
      }
    }
  }
}
```

## Claude Code 설정

`.claude/settings.json`에 추가:

```json
{
  "mcpServers": {
    "dgflow": {
      "command": "node",
      "args": ["D:/DATA2/dongil-ax/mcp-server/dist/index.js"],
      "env": {
        "DGFLOW_API_URL": "http://localhost:3000/api/v1",
        "DGFLOW_API_KEY": "dgf_your_api_key_here"
      }
    }
  }
}
```

## 제공 도구 (Tools)

| Tool | 설명 |
|------|------|
| get_orders | 주문 목록 조회 (상태 필터, 페이지네이션) |
| get_order_detail | 주문 상세 조회 (품목 포함) |
| get_work_orders | 작업의뢰서 목록 조회 |
| get_work_order_detail | 작업의뢰서 상세 (품목+생산이력+재단이력+진행률) |
| get_dashboard_summary | 대시보드 요약 통계 |
| get_production_logs | 복층유리 생산실적 조회 |
| get_cutting_logs | 재단실적 조회 |

## 제공 리소스 (Resources)

| Resource | 설명 |
|----------|------|
| dgflow://system/overview | 시스템 개요 및 도메인 정보 |

## ChatGPT Actions 연동

ChatGPT의 GPTs에서 Actions로 연동하려면:
1. DG-Flow의 OpenAPI 스펙을 가져옵니다: `GET /api/v1/openapi.json`
2. GPT Builder에서 "Add actions" → "Import from URL"로 스펙 URL 입력
3. Authentication에서 "API Key" 선택, Header "Authorization", Prefix "Bearer" 설정

## Gemini 연동

Google AI Studio에서 Function Calling으로 연동:
1. OpenAPI 스펙(`/api/v1/openapi.json`)을 다운로드
2. Gemini API 호출 시 tools 파라미터에 function declarations 추가
3. 각 function의 parameters는 OpenAPI 스펙의 query/path parameters 참조

## 개발 모드

```bash
DGFLOW_API_URL=http://localhost:3000/api/v1 DGFLOW_API_KEY=dgf_test npm run dev
```
