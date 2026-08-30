# DG-Flow - 동일유리 주문관리 시스템

## 프로젝트 개요
- **프로젝트명:** DG-Flow (Dongil Glass Flow)
- **목적:** 동일유리(주) 주문→승인→ERP→생산 전체 워크플로우 디지털화
- **기술 스택:** Next.js (App Router) + Supabase (PostgreSQL/Auth/RLS) + Vercel
- **UI:** shadcn/ui + Tailwind CSS
- **근거 문서:** `data/PRD.md` (요구사항), `data/TASK.md` (태스크 관리)
- **원본 분석:** `Project_planning.md`, `data/1. 발주서 관련/발주서 프로세스.xlsx`

## 핵심 도메인 규칙
- 모든 DB 테이블명은 `dgflow_` 접두사 사용 (예: dgflow_orders, dgflow_users)
- 품명 표기가 발주서와 ERP에서 다름 — dgflow_product_name_mappings 테이블로 변환
- 위치 정보 패턴: `{동}동 {라인}라인({층}) {창위치} {타입} {내/외창}`
- 면적 계산: `가로(mm) x 세로(mm) x 수량 / 1,000,000` (m2)
- 주문 상태 13단계: 초안→고객승인대기→고객승인완료→검토중→검토완료→승인대기→최종승인→ERP입력완료→작업의뢰서생성→생산중→생산완료 (+ 반려-수정중, 반려-재검토)
- ERP(바이투) 엑셀 양식: 16열 고정 포맷
- 주문번호 형식: `{YYMMDD}-{일련번호}`, 의뢰번호 형식: `{YY}-{4자리}`
- 5개 역할(Actor): 공사관리부, 경영지원팀, 관리자(경영진), 생산관리팀, 시스템관리자

## 코딩 컨벤션

### TypeScript
- strict 모드 필수 (noImplicitAny, strictNullChecks)
- 모든 컴포넌트/함수에 명시적 타입 선언
- DB 테이블 타입은 Supabase CLI로 자동 생성 (`types/supabase.ts`)
- enum 대신 `as const` 객체 + 유니온 타입 사용
- 주문 상태(status)는 `types/order-status.ts`에 정의된 상수만 사용

### 파일/폴더 구조
- 페이지: `app/{feature}/page.tsx` (App Router)
- API: `app/api/{feature}/route.ts`
- 컴포넌트: `components/{feature}/{ComponentName}.tsx` (PascalCase)
- 비즈니스 로직: `lib/{domain}/{module}.ts` (camelCase)
- 타입: `types/{domain}.ts`
- SQL 마이그레이션: `supabase/migrations/{timestamp}_{description}.sql`

### 컴포넌트
- Server Component 우선, 클라이언트 상태 필요 시만 `'use client'`
- 폼 입력은 React Hook Form + Zod 스키마 검증
- 테이블 UI는 @tanstack/react-table 사용

### Supabase
- 모든 테이블에 RLS 활성화 — RLS 없는 테이블 생성 금지
- 마이그레이션 파일에 RLS 정책 포함
- FK 관계는 반드시 ON DELETE 동작 명시
- 시딩 데이터는 `supabase/seed.sql`에 관리

### 테스트
- 비즈니스 로직 (`lib/` 하위): 단위 테스트 필수
- 특히 면적 계산, 품명 변환, 규격 그룹핑, 상태 전이 로직은 반드시 테스트
- 테스트 파일: `__tests__/{module}.test.ts`
- 테스트 프레임워크: Vitest

### 보안
- SQL injection 방지: Supabase client의 파라미터 바인딩만 사용, raw SQL 금지
- XSS 방지: 사용자 입력값 렌더링 시 React 기본 이스케이핑 활용
- 고객 승인 토큰: UUID v4, 만료 시간 설정, 일회성 사용
- RLS로 역할별 데이터 접근 제한 — 클라이언트에서 직접 Supabase 호출 시에도 안전

## 개발 워크플로우

### 태스크 진행 절차
1. `data/TASK.md`에서 다음 태스크 확인
2. 태스크 상태를 `[~]`(진행중)로 변경
3. 코드 작성
4. **품질 검증** 실행 (아래 참조)
5. **Peer Review** 실행 (아래 참조)
6. 태스크 상태를 `[x]`(완료)로 변경, 완료일/산출물 기록
7. STEP 완료 시 완료 기준 체크리스트 검증

### 중단 시 필수 절차
1. 진행 중 태스크 `[~]` 표시 유지
2. `data/TASK.md`의 [중단 체크포인트] 섹션 채우기
3. 미완성 코드에 `// TODO: [TASK-{번호}] 중단 지점` 주석
4. 커밋 메시지에 `[WIP] TASK-{번호}` 표기

## 품질 에이전트 (QA Agent)

### 역할
코드 변경 후 자동/수동으로 호출되어 다음을 검증하는 전문 에이전트:

### 검증 체크리스트
호출 시 아래 항목을 순서대로 검증하고 결과를 보고한다:

#### 1. 타입 안전성
- `npx tsc --noEmit` 통과 여부
- Supabase 타입과 실제 쿼리의 일치 여부

#### 2. 비즈니스 로직 정확성
- 면적 계산 공식: `width_mm * height_mm * quantity / 1_000_000`
- 두께 계산: 품명 구성요소 합산 (예: 5+0.76+5+10+6 = 26.76)
- 규격 그룹핑 5규칙 준수 (PRD 9절)
- 상태 전이 규칙: 허용된 전이만 가능한지 (PRD 6.1절)
- 주문번호/의뢰번호 채번 형식

#### 3. 보안 검증
- RLS 정책이 테이블 생성과 함께 존재하는지
- 고객 승인 토큰 만료/일회성 처리
- API 라우트의 인증/권한 검증 존재 여부
- SQL injection 가능 지점 없는지

#### 4. 데이터 정합성
- FK 제약조건 누락 여부
- NOT NULL 제약 적절성
- CASCADE/RESTRICT 동작 적절성
- 합계 계산 (소계/총계) 정확성

#### 5. UI/UX 일관성
- 엑셀 유사 테이블 입력 패턴 준수
- 반응형 레이아웃 (모바일/태블릿)
- 에러 상태 표시
- 로딩 상태 표시

#### 6. 테스트 커버리지
- `lib/` 하위 비즈니스 로직의 단위 테스트 존재 여부
- 특히 계산/변환/상태전이 로직 테스트 필수

### QA 에이전트 호출 방법
STEP 완료 시 또는 주요 기능 구현 후 아래 프롬프트로 호출:
```
/qa 또는 "품질 검증 실행해줘"
→ 변경된 파일을 대상으로 위 체크리스트 순서대로 검증
→ PASS/FAIL 결과 + 구체적 수정 사항 보고
```

## Peer Review 프로세스

### 목적
작성자(Claude)가 놓칠 수 있는 엣지 케이스, 설계 결함, 성능 이슈를 잡기 위한 2차 검증.

### 리뷰 시점
- **필수 리뷰 대상:**
  - DB 마이그레이션 (테이블/RLS 생성)
  - 상태 전이 로직 (워크플로우 핵심)
  - 계산 로직 (면적, 두께, 그룹핑, 집계)
  - 인증/권한 관련 코드
  - ERP 엑셀 생성 로직

- **선택 리뷰 대상:**
  - UI 컴포넌트
  - 단순 CRUD 페이지

### 리뷰 체크포인트

#### 설계 리뷰
- PRD 요구사항과 구현의 일치 여부
- 누락된 엣지 케이스 (예: 반려 후 재승인, 부분 생산, 동시 수정 등)
- 확장성 (Phase 2에서 깨지지 않는 구조인지)

#### 코드 리뷰
- 불필요한 복잡도 없는지 (KISS 원칙)
- 에러 처리 적절성 (외부 경계: API 응답, 파일 I/O)
- N+1 쿼리 등 성능 이슈
- 하드코딩된 매직 넘버/문자열

#### 보안 리뷰
- RLS 우회 가능 경로 없는지
- 권한 없는 사용자의 데이터 접근 가능성
- 토큰/시크릿 노출 가능성

### Peer Review 호출 방법
```
/review 또는 "피어 리뷰 해줘"
→ 변경된 파일 + 관련 PRD 요구사항을 대조하여 리뷰
→ 심각도별 분류: CRITICAL(반드시 수정) / WARNING(권장) / INFO(참고)
→ 각 항목에 구체적 수정 방안 제시
```

## 커밋 컨벤션
```
feat(TASK-3-1): dgflow_orders 테이블 생성
fix(TASK-5A-3): 상태 전이 규칙 누락 수정
test(TASK-3-8): 면적 계산 로직 단위 테스트
refactor(TASK-6-3): 규격 그룹핑 로직 성능 개선
docs: PRD.md 관리자 대시보드 요구사항 추가
```

## 한글 인코딩 주의
- 엑셀 출력 시 한글 컬럼명 인코딩 확인
- PDF 생성 시 한글 폰트 포함 필수 (Noto Sans KR 사용)

---

## 자율 개발 모드 (Autonomous Development)

### 운영 원칙
- **사용자의 의사결정 없이 TASK.md의 모든 태스크를 순서대로 완료**한다.
- 기술 선택, 라이브러리 버전, 구현 방식 등은 아래 사전 확정 사항을 따른다.
- 판단이 필요한 상황에서는 아래 의사결정 기본값을 적용하고, `data/TASK.md` 의사결정 로그에 기록한다.
- 에러 발생 시 3회까지 자체 해결을 시도하고, 해결 불가 시 `data/TASK.md` 이슈 로그에 기록하고 다음 태스크로 진행한다.
- 각 STEP 완료 시 QA 검증과 Peer Review를 **자동 실행**하고 문제 발견 시 즉시 수정한다.

### Supabase DB 접근
- **SELECT:** `node scripts/db.mjs "SQL"` (exec_sql RPC, 빠름)
- **DDL/DML:** `echo "SQL" | npx supabase db query --linked` (테이블 생성, INSERT 등)
- **프로젝트 ref:** xlfrwcrfjuvajskvjwnq (supabase link 완료)
- **환경변수:** `.env.local`에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

### 사전 확정 기술 스택 (의사결정 불필요)

| 카테고리 | 선택 | 버전/비고 |
|---------|------|----------|
| 프레임워크 | Next.js 15 (App Router) | `npx create-next-app@latest --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` |
| DB/Auth | Supabase | 기존 프로젝트 (xlfrwcrfjuvajskvjwnq) |
| UI 컴포넌트 | shadcn/ui | `npx shadcn@latest init` |
| CSS | Tailwind CSS 4 | Next.js와 함께 설치 |
| 폼 관리 | React Hook Form + Zod | `npm install react-hook-form @hookform/resolvers zod` |
| 테이블 UI | @tanstack/react-table | `npm install @tanstack/react-table` |
| 차트 | Recharts | `npm install recharts` (대시보드용) |
| 엑셀 출력 | xlsx (SheetJS) | `npm install xlsx` |
| PDF 생성 | @react-pdf/renderer | `npm install @react-pdf/renderer` |
| 아이콘 | Lucide React | `npm install lucide-react` (shadcn/ui 기본) |
| 날짜 처리 | date-fns | `npm install date-fns` |
| 테스트 | Vitest | `npm install -D vitest @testing-library/react` |
| 상태 관리 | Zustand | `npm install zustand` (필요 시만, Server Component 우선) |
| 이메일 발송 | Resend | `npm install resend` (고객 승인 링크 전송용) |
| 배포 | Vercel | `vercel` CLI 또는 Git push 연동 |

### PRD 미확인 사항 기본 결정 (Q1~Q10)

아래는 사용자 확인 없이 적용할 기본 결정이다. 나중에 변경이 필요하면 코드 수정으로 대응한다.

| # | 미확인 항목 | 기본 결정 | 사유 |
|---|-----------|----------|------|
| Q1 | 발주서 양식 통일 | **통일 불가 전제.** 웹 시스템에서 표준 입력 폼을 제공하여 해결. 기존 엑셀 파싱은 Phase 1 범위 외 | 시스템의 목적 자체가 표준화 |
| Q2 | ERP API 연동 | **엑셀 import/export 방식만 지원.** API 연동은 향후 확장 | 현재 확인 불가, 엑셀이 확실한 방법 |
| Q3 | MES 데이터 export | **수동 입력 방식.** MES 연동은 Phase 2 이후 | Phase 1에서는 불필요 |
| Q4 | 품명 변환 마스터 | **PRD에 확인된 8건 + 코드로 추론 가능한 패턴을 시딩.** 관리자가 UI에서 추가 가능하도록 구현 | 마스터 관리 화면으로 해결 |
| Q5 | 1조 기준 매수 | **1조 = 1세트(외판+내판).** "2조외24" = 2팔레트 + 잔여24매 = 총 26매 | 데이터 패턴에서 추론 |
| Q6 | 분할 생산 빈도 | **빈번하다고 가정.** 모든 생산 입력에 전량/부분/분할 옵션 제공 | 이미지 분석에서 다수 확인됨 |
| Q7 | 재단↔복층 작업의뢰서 | **동일 문서.** 하나의 작업의뢰서에서 재단→복층 순서로 진행 | 의뢰번호 체계가 동일 |
| Q8 | 고객 승인 방식 | **이메일 링크 (Resend).** 토큰 기반 비로그인 승인 페이지. 링크 복사 기능도 제공 (카카오톡 공유용) | 가장 범용적, 개발 간편 |
| Q9 | 1호기/2호기 | **복층 생산 라인 2개.** 주간생산일지에서 별도 섹션으로 관리 | 데이터 구조에서 확인 |
| Q10 | 원판 규격 | **확인된 4종으로 시작.** 관리자가 UI에서 추가 가능하도록 구현 | 마스터 관리 화면으로 해결 |

### 의사결정 기본값 (개발 중 판단 필요 시)

| 상황 | 기본 결정 |
|------|----------|
| 라이브러리 A vs B | 위 사전 확정 목록 우선. 목록에 없으면 npm weekly downloads가 더 많은 것 선택 |
| 컴포넌트 설계 | Server Component 우선. 인터랙션 필요 시만 Client Component |
| API 설계 | Next.js Route Handler 사용. RESTful 패턴 (`GET /api/orders`, `POST /api/orders`) |
| DB 쿼리 | Supabase JS Client 사용 (서버 측은 service_role_key, 클라이언트 측은 anon_key + RLS) |
| 에러 처리 | API 경계에서 try-catch, 내부 로직은 타입으로 보장. toast로 사용자 알림 |
| 데이터 없을 때 | 빈 상태(empty state) UI 표시. "데이터가 없습니다" + 생성 버튼 |
| 페이지네이션 | 기본 20건, 서버 사이드 페이지네이션 (Supabase .range()) |
| 날짜/시간 | 서버: UTC, 클라이언트: KST(Asia/Seoul) 표시 |
| 환경 구분 | .env.local → 개발, Vercel 환경변수 → 프로덕션 |
| git 브랜치 | main 브랜치에서 직접 작업 (단독 개발이므로) |
| 커밋 시점 | 각 STEP 완료 시 (또는 주요 기능 단위 완료 시) |

### 자율 QA/PR 프로세스

각 STEP 완료 시 자동으로 다음을 실행한다 (사용자 호출 불필요):

```
STEP 완료 →
  1. tsc --noEmit (타입 체크)
  2. vitest run (단위 테스트)
  3. QA 체크리스트 자체 검증 (CLAUDE.md 기준)
  4. Peer Review 자체 실행 (Agent tool로 별도 컨텍스트에서 리뷰)
  5. 문제 발견 시 즉시 수정
  6. TASK.md 상태 갱신 + 완료일/산출물 기록
  7. git commit
  8. 다음 STEP 진행
```

### STEP 간 전환 규칙
- STEP N의 모든 태스크가 `[x]`이고 QA/PR이 통과하면 STEP N+1로 자동 진행
- QA/PR에서 CRITICAL 이슈 발견 시: 즉시 수정 후 재검증
- WARNING 이슈: 수정 후 진행
- 블로커(외부 서비스 필요 등): 이슈 로그에 기록, 가능한 범위까지 진행 후 다음 STEP
- 컨텍스트 윈도우 한계 접근 시: TASK.md [중단 체크포인트] 기록 후 사용자에게 "/continue" 또는 "이어서 개발해줘"로 재개 요청

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
