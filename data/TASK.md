# DG-Flow - 동일유리 주문관리 시스템 개발 태스크 관리

> **문서 목적:** 개발 진행 상황의 상세 추적 및 중단 시 이어서 개발하기 위한 체크포인트 로그
> **근거 문서:** PRD.md (요구사항분석서)
> **최종 갱신:** 2026-08-30
> **기술 스택:** Next.js + Supabase (Vercel 배포)

---

## 사용법

- 각 태스크의 상태를 아래 기호로 관리한다:
  - `[ ]` 미착수 | `[~]` 진행중 | `[x]` 완료 | `[!]` 블로커/이슈 | `[-]` 스킵/보류
- 태스크 완료 시 **완료일**과 **산출물**(생성된 파일, 테이블 등)을 기록한다.
- 개발 중단 시 **[중단 체크포인트]** 섹션에 현재 상태를 기록한다.
- 이슈 발생 시 **[이슈 로그]** 섹션에 기록하고 해결 후 상태를 갱신한다.

---

## Phase 1: 핵심 워크플로우 (MVP)

### STEP 0: 프로젝트 초기 설정

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 0-1 | Next.js 프로젝트 생성 (App Router) | [x] | 2026-08-30 | app/layout.tsx, app/page.tsx | Next.js 15.1, App Router |
| 0-2 | TypeScript, ESLint, Tailwind CSS 설정 | [x] | 2026-08-30 | tsconfig.json, tailwind.config.ts, postcss.config.mjs | Tailwind v3, strict TS |
| 0-3 | Supabase 프로젝트 생성 및 연결 | [x] | 2026-08-30 | .env.local | 기존 프로젝트 활용 (xlfrwcrfjuvajskvjwnq) |
| 0-4 | Supabase 클라이언트 유틸 설정 | [x] | 2026-08-30 | lib/supabase/client.ts, server.ts | SSR + service_role 클라이언트 |
| 0-5 | 프로젝트 디렉토리 구조 확정 | [x] | 2026-08-30 | CLAUDE.md, TASK.md 파일구조 섹션 | 기존 Python → legacy/ 이동 |
| 0-6 | UI 컴포넌트 라이브러리 선정 및 설치 | [~] | | package.json | shadcn/ui 초기화 필요 (STEP 1에서 진행) |
| 0-7 | Vercel 배포 연결 및 첫 배포 확인 | [-] | | | 로컬 빌드 성공 확인. Vercel 연결은 별도 진행 |
| 0-8 | Git 저장소 초기화 및 .gitignore 설정 | [x] | 2026-08-30 | .gitignore, 초기 커밋 완료 | main 브랜치 |
| 0-9 | Vitest 설치 및 테스트 환경 구성 | [x] | 2026-08-30 | vitest.config.ts, __tests__/ | jsdom 환경 |
| 0-10 | Claude Code 하네스 hooks 동작 확인 | [x] | 2026-08-30 | .claude/settings.json | tsc 자동 실행 확인 |
| 0-11 | 커밋 컨벤션 및 브랜치 전략 확정 | [x] | 2026-08-30 | CLAUDE.md | feat/fix/test + TASK 번호, main 직접 작업 |

**STEP 0 완료 기준:** 빈 Next.js 앱이 Vercel에 배포되고, Supabase 연결이 확인되고, tsc/eslint/vitest가 동작하는 상태

---

### STEP 1: 사용자 인증 및 권한 관리 (NFR-01, NFR-02)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 1-1 | Supabase Auth 설정 (이메일/비밀번호) | [ ] | | Supabase Auth 설정 | |
| 1-2 | dgflow_users 테이블 생성 (id, email, name, role, department) | [ ] | | SQL migration | role: admin/construction_mgr/biz_support/production_mgr/system_admin |
| 1-3 | RLS 정책 설정 (dgflow_users 테이블) | [ ] | | SQL migration | 본인 정보 조회, 관리자 전체 조회 |
| 1-4 | 로그인 페이지 UI | [ ] | | app/login/page.tsx | |
| 1-5 | 회원가입 페이지 UI (관리자용) | [ ] | | app/admin/users/page.tsx | 자가 가입 아닌 관리자가 등록 |
| 1-6 | 인증 미들웨어 (로그인 체크) | [ ] | | middleware.ts | |
| 1-7 | 역할 기반 라우트 가드 | [ ] | | lib/auth/role-guard.ts | 역할별 접근 가능 페이지 제한 |
| 1-8 | 로그인/로그아웃 동작 검증 | [ ] | | | 테스트 계정 5개 (역할별) |
| 1-9 | 공통 레이아웃 (사이드바, 헤더, 역할별 메뉴) | [ ] | | app/layout.tsx, components/layout/ | |

| 1-QA | QA 검증: RLS 정책 우회 불가 확인, 역할별 접근 제어 테스트 | [ ] | | | CLAUDE.md QA 체크리스트 기준 |
| 1-PR | Peer Review: middleware/RLS/역할가드 코드 리뷰 | [ ] | | | 보안 리뷰 필수 |

**STEP 1 완료 기준:** 역할별 테스트 계정으로 로그인 후 역할에 맞는 메뉴만 표시되는 상태 + QA/PR 통과

---

### STEP 2: 마스터 데이터 관리 (FR-12, FR-13, FR-14)

#### 2-A: 품명 마스터 (FR-12)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 2A-1 | dgflow_products 테이블 생성 | [ ] | | SQL migration | product_code, display_name, erp_name, thickness_mm, outer_glass, spacer, gas, inner_glass, lamination_type |
| 2A-2 | dgflow_product_name_mappings 테이블 생성 | [ ] | | SQL migration | product_id(FK), variant_name |
| 2A-3 | RLS 정책 설정 (dgflow_products, dgflow_product_name_mappings) | [ ] | | SQL migration | 전체 조회 가능, 관리자만 수정 |
| 2A-4 | 초기 품명 데이터 시딩 | [ ] | | seed.sql 또는 seed.ts | PRD 5.3절 변환 규칙 8건 + 추가 |
| 2A-5 | 품명 마스터 목록 페이지 | [ ] | | app/admin/products/page.tsx | 테이블 뷰, 검색/필터 |
| 2A-6 | 품명 마스터 등록/수정 폼 | [ ] | | app/admin/products/[id]/page.tsx | 변형 표기(mappings) 함께 관리 |
| 2A-7 | 품명 자동완성 API | [ ] | | app/api/products/search/route.ts | 주문 입력 시 사용 |

#### 2-B: 거래처/현장 마스터 (FR-13)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 2B-1 | dgflow_customers 테이블 생성 | [ ] | | SQL migration | name, short_name, contact_info |
| 2B-2 | dgflow_sites 테이블 생성 | [ ] | | SQL migration | customer_id(FK), site_name, address, region_sido, region_sigungu |
| 2B-3 | RLS 정책 설정 (dgflow_customers, dgflow_sites) | [ ] | | SQL migration | |
| 2B-4 | 초기 거래처 데이터 시딩 | [ ] | | seed.sql | 복층생산일지 업체현장명 167건 활용 |
| 2B-5 | 거래처 목록/등록/수정 페이지 | [ ] | | app/admin/customers/page.tsx | |
| 2B-6 | 현장 목록/등록/수정 페이지 | [ ] | | app/admin/sites/page.tsx | 거래처 연결 |
| 2B-7 | 거래처/현장 검색 API | [ ] | | app/api/customers/search/route.ts | 자동완성용 |

#### 2-C: 원판 마스터 (FR-14)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 2C-1 | dgflow_raw_glasses 테이블 생성 | [ ] | | SQL migration | glass_type, width_mm, height_mm, area_m2 |
| 2C-2 | 초기 원판 데이터 시딩 (4종) | [ ] | | seed.sql | 2438x3353, 1981x3353, 1829x3353, 1829x3048 |
| 2C-3 | 원판 마스터 관리 페이지 | [ ] | | app/admin/raw-glasses/page.tsx | Phase 2에서 본격 사용 |

| 2-QA | QA 검증: 품명 변환 매핑 정확성, RLS 정책, 시딩 데이터 정합성 | [ ] | | | |
| 2-PR | Peer Review: 마스터 테이블 스키마 설계 리뷰 | [ ] | | | FK/제약조건 검토 |

**STEP 2 완료 기준:** 품명 8건 이상, 거래처 167건, 원판 4건이 DB에 존재하고 관리 화면에서 CRUD 가능 + QA/PR 통과

---

### STEP 3: 주문정보 입력 (FR-01)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 3-1 | dgflow_orders 테이블 생성 | [ ] | | SQL migration | order_number, customer_id, site_id, created_by, order_date, delivery_date, status, created_at, updated_at |
| 3-2 | dgflow_order_items 테이블 생성 | [ ] | | SQL migration | order_id, product_id, width_mm, height_mm, quantity, area_m2, location_dong, location_line, location_floor, location_room, location_type, location_window_type, remark, sort_order |
| 3-3 | RLS 정책 설정 (dgflow_orders, dgflow_order_items) | [ ] | | SQL migration | 공사관리부: 본인 주문, 경영지원팀/관리자: 전체 |
| 3-4 | 주문 목록 페이지 | [ ] | | app/orders/page.tsx | 상태 필터, 날짜 필터, 거래처 검색 |
| 3-5 | 주문 생성 페이지 - 기본정보 영역 | [ ] | | app/orders/new/page.tsx | 거래처 선택(자동완성), 현장 선택, 주문일/납품일 |
| 3-6 | 주문 생성 페이지 - 품목 입력 테이블 | [ ] | | components/order/OrderItemsTable.tsx | 행 추가/삭제, 품명 선택(자동완성), 규격/수량 입력 |
| 3-7 | 위치정보 구조화 입력 컴포넌트 | [ ] | | components/order/LocationInput.tsx | 동, 라인, 층, 창위치, 타입, 창구분 각각 입력 → 조합 |
| 3-8 | 면적(m2) 자동 계산 로직 | [ ] | | lib/calc/area.ts | 가로(mm) x 세로(mm) x 수량 / 1,000,000 |
| 3-9 | 두께 자동 계산 로직 (품명 기반) | [ ] | | lib/calc/thickness.ts | 품명 구성요소 두께 합산 |
| 3-10 | 주문 저장 API (상태: 초안) | [ ] | | app/api/orders/route.ts | dgflow_orders + dgflow_order_items 트랜잭션 저장 |
| 3-11 | 주문 수정 페이지 | [ ] | | app/orders/[id]/edit/page.tsx | 초안/반려 상태에서만 수정 가능 |
| 3-12 | 주문 상세 조회 페이지 | [ ] | | app/orders/[id]/page.tsx | 품목 목록, 합계, 상태 이력 |
| 3-13 | 품목 행 복사/일괄 입력 기능 | [ ] | | | 동일 규격 다수 입력 시 편의성 |
| 3-14 | 입력 데이터 유효성 검증 | [ ] | | lib/validation/order.ts | 필수값, 규격 범위, 수량 양수 등 |

| 3-QA | QA 검증: 면적 계산 정확성, 유효성 검증 로직, RLS 정책 | [ ] | | | 면적/두께 계산 단위 테스트 필수 |
| 3-PR | Peer Review: 주문 입력 폼, 위치정보 파싱, 데이터 저장 로직 | [ ] | | | |

**STEP 3 완료 기준:** 공사관리부 계정으로 로그인하여 주문정보(거래처, 현장, 품목 다수)를 입력하고 초안 저장 가능 + QA/PR 통과

---

### STEP 4: 주문의뢰서 생성 (FR-02)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 4-1 | 주문의뢰서 미리보기 페이지 | [ ] | | app/orders/[id]/preview/page.tsx | 표준 양식 레이아웃 |
| 4-2 | 품명별 소계/전체 합계 계산 로직 | [ ] | | lib/calc/subtotal.ts | 수량 합계, 면적 합계 |
| 4-3 | 주문의뢰서 PDF 생성 | [ ] | | lib/export/pdf.ts | react-pdf 또는 puppeteer |
| 4-4 | 주문의뢰서 엑셀 다운로드 | [ ] | | lib/export/excel.ts | xlsx 라이브러리 |
| 4-5 | 인쇄용 레이아웃 CSS | [ ] | | styles/print.css | @media print |

| 4-QA | QA 검증: 소계/합계 계산 정확성, PDF/엑셀 출력 데이터 일치 | [ ] | | | |
| 4-PR | Peer Review: 주문의뢰서 양식 레이아웃, 출력물 품질 | [ ] | | | |

**STEP 4 완료 기준:** 저장된 주문을 선택하면 표준 양식의 주문의뢰서가 화면에 표시되고 PDF/엑셀 다운로드 가능 + QA/PR 통과

---

### STEP 5: 승인 워크플로우 (FR-03, FR-04, FR-05)

#### 5-A: 데이터/API 기반

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 5A-1 | dgflow_approvals 테이블 생성 | [ ] | | SQL migration | order_id, step(customer/review/approve), status(pending/approved/rejected), approved_by, comment, created_at |
| 5A-2 | dgflow_approval_tokens 테이블 생성 | [ ] | | SQL migration | order_id, token(UUID), expires_at, used_at | 고객 승인 링크용 |
| 5A-3 | 주문 상태 변경 API | [ ] | | app/api/orders/[id]/status/route.ts | 상태 전이 규칙 검증 포함 |
| 5A-4 | 승인/반려 API | [ ] | | app/api/approvals/route.ts | step별 권한 검증 |
| 5A-5 | 상태 변경 이력 기록 (audit trail) | [ ] | | dgflow_order_status_logs 테이블 | NFR-04 |

#### 5-B: 고객 승인 (FR-03)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 5B-1 | 고객 승인 토큰 생성 API | [ ] | | app/api/approvals/customer-token/route.ts | UUID 토큰, 만료일 설정 |
| 5B-2 | 고객 승인 링크 발송 기능 | [ ] | | lib/email/send-approval.ts | 이메일 또는 링크 복사 |
| 5B-3 | 고객 승인 페이지 (비로그인 접근) | [ ] | | app/approval/[token]/page.tsx | 토큰 검증, 주문의뢰서 표시, 승인/반려 버튼 |
| 5B-4 | 고객 반려 시 사유 입력 + 알림 | [ ] | | | 공사관리부에 알림 |

#### 5-C: 경영지원팀 검토 (FR-04)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 5C-1 | 검토 대기 주문 목록 (경영지원팀 뷰) | [ ] | | app/review/page.tsx | 고객승인완료 상태 필터 |
| 5C-2 | 주문 검토 페이지 | [ ] | | app/review/[id]/page.tsx | 데이터 확인, 수정 가능 |
| 5C-3 | 품명 변환 자동 매핑 표시 | [ ] | | components/review/ProductMapping.tsx | 발주서 표기 → ERP 표기 자동 매핑 |
| 5C-4 | 규격 그룹핑 미리보기 | [ ] | | components/review/GroupingPreview.tsx | 동일 품명+규격 묶음 결과 |
| 5C-5 | 검토 완료 처리 | [ ] | | | 상태: 검토완료 |

#### 5-D: 관리자 승인 (FR-05)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 5D-1 | 승인 대기 주문 목록 (관리자 뷰) | [ ] | | app/approve/page.tsx | 검토완료 상태 필터 |
| 5D-2 | 승인 상세 페이지 (요약 정보) | [ ] | | app/approve/[id]/page.tsx | 거래처, 품목 수, 총 수량, 총 면적 |
| 5D-3 | 승인/반려 처리 + 사유 입력 | [ ] | | | 반려 시 경영지원팀에 알림 |

#### 5-E: 알림 시스템

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 5E-1 | dgflow_notifications 테이블 생성 | [ ] | | SQL migration | user_id, type, message, order_id, is_read, created_at |
| 5E-2 | 알림 생성 로직 (상태 변경 시) | [ ] | | lib/notification/create.ts | |
| 5E-3 | 알림 표시 UI (헤더 벨 아이콘) | [ ] | | components/layout/NotificationBell.tsx | 안 읽은 알림 수 뱃지 |
| 5E-4 | 알림 목록 페이지 | [ ] | | app/notifications/page.tsx | |

| 5-QA | QA 검증: 상태 전이 규칙(13개 상태), 토큰 보안, 권한별 접근 제어 | [ ] | | | 상태 전이 단위 테스트 필수 |
| 5-PR | Peer Review: 워크플로우 엣지케이스 (동시 승인, 만료 토큰, 이중 반려 등) | [ ] | | | CRITICAL 리뷰 대상 |

**STEP 5 완료 기준:** 초안→고객승인→검토→최종승인 전체 워크플로우가 동작하고, 각 단계에서 알림이 발생 + QA/PR 통과

---

### STEP 6: ERP 입력 데이터 자동 생성 (FR-06)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 6-1 | 주문번호 자동 채번 로직 | [ ] | | lib/erp/order-number.ts | `{YYMMDD}-{일련번호}` 형식 |
| 6-2 | 품명 자동 변환 로직 | [ ] | | lib/erp/product-convert.ts | dgflow_product_name_mappings 테이블 참조 |
| 6-3 | 규격 그룹핑 로직 | [ ] | | lib/erp/grouping.ts | PRD 9절 규칙 5개 적용 |
| 6-4 | ERP 엑셀 양식(16열) 생성 | [ ] | | lib/erp/export-excel.ts | 주문번호, 주문일자, 납품일자, 거래처, 현장명, 구분(TP), 품명, 두께, 가로, 세로, 주문수량, 출고수량, 잔여수량, 면적, 미출고액, 비고 |
| 6-5 | ERP 데이터 미리보기 페이지 | [ ] | | app/orders/[id]/erp-preview/page.tsx | 변환 결과 확인 |
| 6-6 | ERP 엑셀 다운로드 버튼 | [ ] | | | 최종승인 상태에서만 활성화 |
| 6-7 | ERP 입력 완료 상태 처리 | [ ] | | | 다운로드 후 상태 변경 |
| 6-8 | 변환 결과 검증 (원본 대비) | [ ] | | | 수량 합계 일치 확인 |

| 6-QA | QA 검증: 품명 변환 정확성, 그룹핑 규칙 5개, 16열 엑셀 포맷, 수량 합계 일치 | [ ] | | | 그룹핑/변환 단위 테스트 필수 |
| 6-PR | Peer Review: ERP 엑셀과 기존 `발주서 프로세스.xlsx` 엑셀양식 시트 대조 검증 | [ ] | | | CRITICAL 리뷰 대상 |

**STEP 6 완료 기준:** 최종 승인된 주문에서 ERP import용 16열 엑셀이 생성되고, 기존 `발주서 프로세스.xlsx`의 "엑셀양식" 시트와 동일한 형식 + QA/PR 통과

---

### STEP 7: 관리자 대시보드 (FR-15)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 7-1 | 대시보드 페이지 레이아웃 | [ ] | | app/dashboard/page.tsx | 그리드 기반 카드 배치 |
| 7-2 | 요약 카드 (신규/대기/수량/면적) | [ ] | | components/dashboard/SummaryCards.tsx | 오늘/이번주/이번달 전환 |
| 7-3 | 상태별 파이프라인 차트 | [ ] | | components/dashboard/StatusPipeline.tsx | 각 상태별 건수 |
| 7-4 | 기간별 추이 차트 (일/주/월) | [ ] | | components/dashboard/TrendChart.tsx | recharts 또는 chart.js |
| 7-5 | 지역별 현황 (시/도 집계) | [ ] | | components/dashboard/RegionStats.tsx | 테이블 또는 지도 |
| 7-6 | 거래처별 현황 (상위 순위) | [ ] | | components/dashboard/CustomerRanking.tsx | |
| 7-7 | 담당자별 현황 | [ ] | | components/dashboard/StaffStats.tsx | 입력 건수, 평균 처리일 |
| 7-8 | 납기 임박/지연 알림 목록 | [ ] | | components/dashboard/DeliveryAlert.tsx | D-7 이내, 지연 건 |
| 7-9 | 필터링 컴포넌트 (기간/지역/거래처/상태/담당자) | [ ] | | components/dashboard/DashboardFilters.tsx | |
| 7-10 | 드릴다운 (차트 클릭 → 주문 목록) | [ ] | | | 라우터 연동 |
| 7-11 | 대시보드 데이터 집계 API | [ ] | | app/api/dashboard/route.ts | Supabase RPC 또는 뷰 |
| 7-12 | 대시보드 엑셀/PDF 내보내기 | [ ] | | | 조회 결과 다운로드 |

| 7-QA | QA 검증: 집계 쿼리 정확성, 필터 조합별 결과 일관성, 성능(2초 이내) | [ ] | | | |
| 7-PR | Peer Review: 대시보드 UX, 드릴다운 동작, 데이터 내보내기 | [ ] | | | |

**STEP 7 완료 기준:** 관리자 로그인 시 대시보드에 주문 현황이 지역별/기간별/거래처별로 시각화되고 필터링/드릴다운 동작 + QA/PR 통과

---

### Phase 1 완료 기준 체크리스트

| # | 검증 항목 | 상태 |
|---|----------|------|
| V-01 | 역할별 로그인 및 메뉴 분기 동작 | [ ] |
| V-02 | 품명/거래처/현장 마스터 CRUD 동작 | [ ] |
| V-03 | 공사관리부가 주문 입력 → 초안 저장 | [ ] |
| V-04 | 주문의뢰서 PDF/엑셀 출력 | [ ] |
| V-05 | 고객 승인 링크 → 비로그인 승인 동작 | [ ] |
| V-06 | 경영지원팀 검토 → 검토완료 처리 | [ ] |
| V-07 | 관리자 최종 승인 동작 | [ ] |
| V-08 | 반려 → 재수정 → 재승인 흐름 동작 | [ ] |
| V-09 | ERP 16열 엑셀 생성 및 다운로드 | [ ] |
| V-10 | 관리자 대시보드 시각화 및 필터링 동작 | [ ] |
| V-11 | 알림 발생 및 표시 동작 | [ ] |
| V-12 | Vercel 프로덕션 배포 정상 | [ ] |

---

## Phase 2: 생산 모니터링 (확장)

### STEP 8: 작업의뢰서 관리 (FR-07)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 8-1 | dgflow_work_orders 테이블 생성 | [ ] | | SQL migration | order_id(FK), work_order_number, request_date, delivery_date, status |
| 8-2 | dgflow_work_order_items 테이블 생성 | [ ] | | SQL migration | work_order_id, product_id, width_mm, height_mm, quantity, area_m2, remark |
| 8-3 | RLS 정책 설정 | [ ] | | SQL migration | |
| 8-4 | 주문 → 작업의뢰서 자동 생성 로직 | [ ] | | lib/work-order/generate.ts | ERP입력완료 상태에서 트리거 |
| 8-5 | 의뢰번호 자동 채번 (`{YY}-{4자리}`) | [ ] | | | |
| 8-6 | 작업의뢰서 목록 페이지 | [ ] | | app/work-orders/page.tsx | |
| 8-7 | 작업의뢰서 상세/인쇄 페이지 | [ ] | | app/work-orders/[id]/page.tsx | 결재란 포함 |

| 8-QA | QA 검증: 의뢰번호 채번 정확성, 주문→작업의뢰서 데이터 매핑 일치 | [ ] | | | |
| 8-PR | Peer Review: 자동 생성 로직, 양식 레이아웃 | [ ] | | | |

**STEP 8 완료 기준:** 최종 승인된 주문에서 작업의뢰서가 자동 생성되고, 표준 양식으로 조회/인쇄 가능 + QA/PR 통과

---

### STEP 9: 복층 생산실적 입력 (FR-08)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 9-1 | dgflow_production_logs 테이블 생성 | [ ] | | SQL migration | work_order_id, production_date, log_type(full/partial), quantity_completed, area_m2, shift, remark |
| 9-2 | dgflow_production_log_items 테이블 생성 | [ ] | | SQL migration | 개별 품목별 생산 수량 |
| 9-3 | RLS 정책 설정 | [ ] | | SQL migration | |
| 9-4 | 생산 대상 목록 (작업의뢰서 기반) | [ ] | | app/production/page.tsx | 미완료 의뢰서 목록 |
| 9-5 | 생산 수량 입력 UI | [ ] | | app/production/[id]/page.tsx | 전량완료/부분완료/분할생산 |
| 9-6 | 잔여 수량 자동 추적 로직 | [ ] | | lib/production/remaining.ts | 의뢰수량 - 누적생산수량 |
| 9-7 | 외판+내판 쌍 자동 생성 | [ ] | | lib/production/pair.ts | 1복층 = 2행 |
| 9-8 | 복층생산일지 엑셀 출력 (기존 양식) | [ ] | | lib/export/production-daily.ts | 14열, 기존 양식 호환 |

| 9-QA | QA 검증: 잔여수량 추적 정확성, 외판+내판 쌍 생성, 엑셀 양식 호환(14열) | [ ] | | | |
| 9-PR | Peer Review: 분할 생산 엣지케이스, 수량 일관성 | [ ] | | | |

**STEP 9 완료 기준:** 작업의뢰서 기반으로 복층 생산 수량을 입력하고, 기존 양식의 복층생산일지 엑셀을 출력 가능 + QA/PR 통과

---

### STEP 10: 재단 생산실적 입력 (FR-09)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 10-1 | dgflow_cutting_logs 테이블 생성 | [ ] | | SQL migration | work_order_id, cutting_date, product_id, quantity, area_m2, raw_glass_type, raw_width, raw_height, raw_quantity, raw_area_m2, shift, remark |
| 10-2 | RLS 정책 설정 | [ ] | | SQL migration | |
| 10-3 | 재단 대상 목록 페이지 | [ ] | | app/cutting/page.tsx | |
| 10-4 | 재단 수량 입력 UI | [ ] | | app/cutting/[id]/page.tsx | |
| 10-5 | 원판 선택/수량 입력 컴포넌트 | [ ] | | components/cutting/RawGlassInput.tsx | 원판 마스터 기반 드롭다운 |
| 10-6 | 같이재단 처리 (다수 주문 연결) | [ ] | | | N:N 관계 |
| 10-7 | 오도시/주간/야간 구분 | [ ] | | | |
| 10-8 | 절단일보 엑셀 출력 (기존 양식) | [ ] | | lib/export/cutting-daily.ts | 12~15열, 기존 양식 호환 |

| 10-QA | QA 검증: 원판 면적 계산, 같이재단 N:N 관계, 엑셀 양식 호환(12~15열) | [ ] | | | |
| 10-PR | Peer Review: 같이재단/오도시 처리 로직, 데이터 모델 | [ ] | | | |

**STEP 10 완료 기준:** 재단 실적 + 원판 사용 정보를 입력하고, 기존 양식의 절단일보 엑셀을 출력 가능 + QA/PR 통과

---

### STEP 11: 생산 현황 모니터링 (FR-10)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 11-1 | 주문별 생산 진행률 계산 API | [ ] | | app/api/production/progress/route.ts | 의뢰수량 대비 생산완료수량 |
| 11-2 | 생산 현황 대시보드 | [ ] | | app/production/dashboard/page.tsx | |
| 11-3 | 주문별 생산 진행률 바 | [ ] | | components/production/ProgressBar.tsx | |
| 11-4 | 분할 생산 이력 타임라인 | [ ] | | components/production/Timeline.tsx | 날짜별 생산량 |
| 11-5 | 공사관리부 본인 주문 생산 현황 | [ ] | | | 본인 입력 주문만 필터 |

---

### STEP 12: 주간 생산실적 자동 집계 (FR-11)

| # | 태스크 | 상태 | 완료일 | 산출물 | 비고 |
|---|--------|------|--------|--------|------|
| 12-1 | 주차별 집계 로직 | [ ] | | lib/production/weekly-aggregate.ts | |
| 12-2 | KPI 자동 계산 | [ ] | | lib/production/kpi.ts | 생산조, M2, 시간당, 목표대비%, 바코드비율 |
| 12-3 | 1호기/2호기 별도 집계 | [ ] | | | |
| 12-4 | 주간생산일지 엑셀 출력 (기존 양식) | [ ] | | lib/export/production-weekly.ts | 144행x52열, 기존 양식 호환 |
| 12-5 | 주간 생산실적 조회 페이지 | [ ] | | app/production/weekly/page.tsx | |

---

### Phase 2 완료 기준 체크리스트

| # | 검증 항목 | 상태 |
|---|----------|------|
| V-13 | 주문 → 작업의뢰서 자동 생성 동작 | [ ] |
| V-14 | 복층 생산 전량/부분/분할 입력 동작 | [ ] |
| V-15 | 복층생산일지 엑셀 기존 양식 호환 | [ ] |
| V-16 | 재단 실적 + 원판 정보 입력 동작 | [ ] |
| V-17 | 절단일보 엑셀 기존 양식 호환 | [ ] |
| V-18 | 주문별 생산 진행률 모니터링 동작 | [ ] |
| V-19 | 주간생산일지 자동 집계 및 출력 | [ ] |
| V-20 | 공사관리부 본인 주문 생산 현황 조회 | [ ] |

---

## Phase 3: 미확인 사항 확인 및 보정 (개발 완료 후)

> Phase 1~2 개발 완료 후, 동일유리 현업과 하나씩 확인하며 시스템을 보정한다.
> 기본 결정으로 구현한 부분을 실제 업무에 맞게 조정하는 단계.

### 긴급 확인 (Phase 1 영향)

| # | 확인 항목 | 기본 결정 | 확인 방법 | 상태 | 보정 내용 |
|---|----------|----------|----------|------|----------|
| Q4 | 품명 변환 규칙 마스터 | 8건 시딩 | 경영지원팀에 전체 품명 목록 요청 | [ ] | |
| Q5 | 1조 기준 매수 | 1조=1세트, "2조외24"=26매 | 생산관리팀에 확인 | [ ] | |
| Q8 | 고객 승인 방식 | 이메일 링크 + 링크 복사 | 공사관리부/고객에게 선호 확인 | [ ] | |

### 중요 확인 (Phase 2 영향)

| # | 확인 항목 | 기본 결정 | 확인 방법 | 상태 | 보정 내용 |
|---|----------|----------|----------|------|----------|
| Q2 | ERP API 연동 | 엑셀만 | 바이투 담당자에 API 문의 | [ ] | |
| Q3 | MES 데이터 export | 수동 입력 | MES 벤더에 export 형식 문의 | [ ] | |
| Q7 | 재단↔복층 작업의뢰서 | 동일 문서 | 경영지원팀에 실물 확인 | [ ] | |

### 참고 확인 (UI 개선)

| # | 확인 항목 | 기본 결정 | 확인 방법 | 상태 | 보정 내용 |
|---|----------|----------|----------|------|----------|
| Q1 | 발주서 양식 통일 | 통일 불가 전제 | 공사관리부에 통일 의향 확인 | [ ] | |
| Q6 | 분할 생산 빈도 | 빈번 가정 | 생산관리팀에 비율 확인 | [ ] | |
| Q9 | 1호기/2호기 | 생산 라인 2개 | 공장 방문 확인 | [ ] | |
| Q10 | 원판 규격 전체 | 4종 시딩 | 자재팀에 전체 목록 요청 | [ ] | |

---

## 중단 체크포인트

> 개발 중단 시 아래 항목을 반드시 기록하고 저장한다.
> 재개 시 이 섹션을 먼저 확인하여 중단 지점부터 이어서 개발한다.

### 최근 중단 기록

| 항목 | 내용 |
|------|------|
| **중단일시** | 2026-08-30 13:30 |
| **현재 STEP** | STEP 3 완료, STEP 4~7 미착수 |
| **진행중 태스크** | 없음 (깔끔한 중단점) |
| **완료된 태스크** | STEP 0 전체, STEP 1 전체, STEP 2 전체, STEP 3 (3-1~3-12), STEP 5 부분(5A-1~5A-5, 5A 상태변경API) |
| **다음 작업** | STEP 4(주문의뢰서 PDF/엑셀), STEP 5 나머지(5B 고객승인, 5C 검토, 5D 관리자승인, 5E 알림), STEP 6(ERP 엑셀), STEP 7(대시보드) |
| **미완성 코드 위치** | 없음. 모든 커밋된 코드는 빌드+테스트 통과 |
| **알려진 버그/이슈** | 없음 |
| **DB 마이그레이션 상태** | 3개 적용 완료 (001_users, 002_master, 003_orders). 12개 테이블 생성됨 |
| **환경 변수 상태** | .env.local 설정 완료 (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY) |
| **브랜치 상태** | main, 3개 커밋, 클린 상태 |

### 중단 시 기록 절차

1. 현재 진행 중인 태스크 번호를 `[~]`로 표시
2. 위 중단 기록 테이블 채우기
3. 미완성 코드에 `// TODO: [TASK-{번호}] 중단 지점` 주석 추가
4. 작업 브랜치 커밋 및 푸시
5. 이 파일(TASK.md) 커밋

---

## 이슈 로그

> 개발 중 발생한 이슈를 기록한다. 해결 시 상태를 갱신한다.

| # | 발생일 | STEP | 이슈 내용 | 상태 | 해결 내용 | 해결일 |
|---|--------|------|----------|------|----------|--------|
| I-01 | | | | | | |

---

## 의사결정 로그

> 개발 중 내린 기술적/설계적 결정을 기록한다. 나중에 "왜 이렇게 했지?" 의문이 생길 때 참조한다.

| # | 결정일 | 주제 | 선택지 | 결정 | 사유 |
|---|--------|------|--------|------|------|
| D-01 | | | | | |

---

## DB 마이그레이션 이력

> 적용된 마이그레이션을 순서대로 기록한다. 중단 후 재개 시 DB 상태 파악에 사용한다.

| # | 적용일 | 파일명 | 내용 | STEP |
|---|--------|--------|------|------|
| M-01 | | | | |

---

## 배포 이력

| # | 배포일 | 버전/커밋 | 내용 | 환경 |
|---|--------|----------|------|------|
| R-01 | | | | preview / production |

---

## 파일 구조 (계획)

```
dongil-ax/
├── app/
│   ├── layout.tsx                    # 공통 레이아웃
│   ├── page.tsx                      # 홈 (→ 대시보드 리다이렉트)
│   ├── login/page.tsx                # 로그인
│   ├── dashboard/page.tsx            # 관리자 대시보드 (FR-15)
│   ├── orders/
│   │   ├── page.tsx                  # 주문 목록
│   │   ├── new/page.tsx              # 주문 생성
│   │   └── [id]/
│   │       ├── page.tsx              # 주문 상세
│   │       ├── edit/page.tsx         # 주문 수정
│   │       ├── preview/page.tsx      # 주문의뢰서 미리보기
│   │       └── erp-preview/page.tsx  # ERP 데이터 미리보기
│   ├── approval/[token]/page.tsx     # 고객 승인 (비로그인)
│   ├── review/
│   │   ├── page.tsx                  # 검토 대기 목록
│   │   └── [id]/page.tsx             # 검토 상세
│   ├── approve/
│   │   ├── page.tsx                  # 승인 대기 목록
│   │   └── [id]/page.tsx             # 승인 상세
│   ├── work-orders/                  # Phase 2
│   ├── production/                   # Phase 2
│   ├── cutting/                      # Phase 2
│   ├── notifications/page.tsx        # 알림 목록
│   ├── admin/
│   │   ├── users/page.tsx            # 사용자 관리
│   │   ├── products/page.tsx         # 품명 마스터
│   │   ├── customers/page.tsx        # 거래처 마스터
│   │   ├── sites/page.tsx            # 현장 마스터
│   │   └── raw-glasses/page.tsx      # 원판 마스터
│   └── api/
│       ├── orders/
│       ├── approvals/
│       ├── dashboard/
│       └── ...
├── components/
│   ├── layout/                       # 사이드바, 헤더, 알림
│   ├── order/                        # 주문 관련 컴포넌트
│   ├── review/                       # 검토 관련 컴포넌트
│   ├── dashboard/                    # 대시보드 차트/카드
│   ├── production/                   # Phase 2
│   ├── cutting/                      # Phase 2
│   └── ui/                           # shadcn/ui 기본 컴포넌트
├── lib/
│   ├── supabase/                     # Supabase 클라이언트
│   ├── auth/                         # 인증/권한
│   ├── calc/                         # 계산 로직 (면적, 두께, 소계)
│   ├── erp/                          # ERP 변환/그룹핑/엑셀
│   ├── export/                       # PDF/엑셀 출력
│   ├── validation/                   # 유효성 검증
│   ├── notification/                 # 알림
│   ├── email/                        # 이메일 발송
│   ├── production/                   # Phase 2
│   └── work-order/                   # Phase 2
├── types/                            # TypeScript 타입 정의
├── styles/                           # 글로벌/인쇄 CSS
├── supabase/
│   └── migrations/                   # SQL 마이그레이션 파일
├── public/
├── .env.local                        # 환경 변수 (Git 제외)
├── TASK.md                           # 이 문서 (DG-Flow 태스크 관리)
└── data/PRD.md                       # DG-Flow 요구사항분석서
```
