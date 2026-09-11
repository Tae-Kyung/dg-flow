# DG-Flow 시스템 설계 문서

> 문서 버전: 1.0 | 최종 갱신: 2026-09-11
> 프로젝트: DG-Flow (Dongil Glass Flow) - 동일유리(주) 주문관리 시스템

---

## 1. 시스템 개요

### 1.1 목적
동일유리(주)의 **주문 접수 → 승인 → 작업의뢰 → 생산** 전체 워크플로우를 디지털화하여,
수기/엑셀 기반 업무를 웹 시스템으로 전환한다.

### 1.2 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | Next.js 16 (App Router, Turbopack) | React 19, Server Components |
| UI 프레임워크 | shadcn/ui + Tailwind CSS v4 | @base-ui 기반 |
| 백엔드/DB | Supabase (PostgreSQL 15) | Auth, Storage, RLS |
| 호스팅 | Vercel | 자동 배포 (main push) |
| 엑셀 처리 | xlsx (SheetJS) | 발주서 파싱, ERP 출력 |
| 차트 | recharts | 대시보드 추이 차트 |

### 1.3 시스템 규모

| 항목 | 수량 |
|------|------|
| 페이지 | 20개 |
| API 엔드포인트 | 15개 |
| DB 테이블 | 18개 |
| 등록 사용자 | 9명 (5개 역할) |

---

## 2. 아키텍처

### 2.1 전체 구조

```
┌──────────────────────────────────────────────────────┐
│                    Vercel (호스팅)                     │
│  ┌────────────────────────────────────────────────┐  │
│  │           Next.js 16 App Router                │  │
│  │  ┌──────────────┐  ┌───────────────────────┐  │  │
│  │  │ Server       │  │ Client Components     │  │  │
│  │  │ Components   │  │ (인터랙션, 폼, 차트)   │  │  │
│  │  │ (목록, 상세) │  │                       │  │  │
│  │  └──────┬───────┘  └───────────┬───────────┘  │  │
│  │         │                      │              │  │
│  │  ┌──────┴──────────────────────┴───────────┐  │  │
│  │  │        API Routes (/api/*)              │  │  │
│  │  │  주문 | 승인 | 생산 | 알림 | 마스터     │  │  │
│  │  └──────────────────┬──────────────────────┘  │  │
│  └─────────────────────┼─────────────────────────┘  │
└────────────────────────┼─────────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │    Supabase (Cloud)       │
           │  ┌─────────────────────┐  │
           │  │ PostgreSQL (18 tbl) │  │
           │  │ + RLS Policies      │  │
           │  ├─────────────────────┤  │
           │  │ Auth (Supabase Auth)│  │
           │  ├─────────────────────┤  │
           │  │ Storage (첨부파일)   │  │
           │  └─────────────────────┘  │
           └───────────────────────────┘
```

### 2.2 인증 구조

```
로그인 페이지 (Client)
  │
  ├─ Supabase Auth signInWithPassword()
  │
  ├─ POST /api/auth/callback (서버 쿠키 설정)
  │
  └─ window.location.href = '/dashboard'
       │
       └─ app/(authenticated)/layout.tsx
            └─ getCurrentUser() → auth.getUser() + dgflow_users 조회
```

**주의사항:**
- middleware 사용 금지 (Next.js 16에서 Supabase SSR 세션 파싱 실패)
- dgflow_users 조회는 반드시 `createServiceRoleClient()` 사용 (RLS 재귀 방지)

### 2.3 Supabase 클라이언트 사용 규칙

| 컨텍스트 | 클라이언트 | 용도 |
|----------|-----------|------|
| Client Component | `createClient()` | 브라우저에서 실시간 조회 |
| Server Component / API | `createServerSupabaseClient()` | 쿠키 기반 세션, 일반 조회 |
| 서버 관리자 권한 | `createServiceRoleClient()` | RLS 우회, 사용자 조회, 작업의뢰서/생산실적 등 |

---

## 3. 핵심 워크플로우

### 3.1 주문 상태 머신 (14단계)

```
  draft ──→ completed ──→ pending_customer ──→ customer_approved
  (작성중)   (작성완료)    (고객승인대기)        (고객승인완료)
    ↑                          │                     │
    └──── rejected_by_customer ←┘                     ↓
          (반려-수정중)                          under_review
                                                (검토중)
                                                     │
                   rejected_by_admin ←── review_completed
                   (반려-재검토)          (검토완료)
                        │                     │
                        └──→ under_review      ↓
                                          final_approved ──→ work_order_created
                                          (최종승인)         (작업의뢰서생성)
                                               │                    │
                                               ↓                    ↓
                                          review_completed     in_production
                                          (승인취소 복귀)      (생산중)
                                                                    │
                                                                    ↓
                                                            production_completed
                                                               (생산완료)
```

### 3.2 작업의뢰서 생성 경로 (2가지)

```
경로 A: 주문 기반                    경로 B: 바이투 엑셀 직접 업로드
─────────────────                  ──────────────────────────
주문 최종승인                        바이투 엑셀 업로드
  │                                  │
  ↓                                  ↓
작업의뢰서 자동 생성                  파서로 의뢰번호별 그룹핑
(order_id 연결)                     (order_id = NULL)
  │                                  │
  ↓                                  ↓
생산실적 입력                        생산실적 입력
  │                                  │
  ↓                                  ↓
생산완료                             생산완료
```

### 3.3 생산실적 수정 흐름

```
생산실적 입력/수정/삭제
  │
  ├─ 입력: POST /api/production → 로그 추가 → produced_quantity 재계산
  │
  ├─ 수정: PUT /api/production → 변경이력 저장 → 로그 수정 → 재계산
  │        (사유 필수, dgflow_production_log_history에 기록)
  │
  └─ 삭제: DELETE /api/production → 변경이력 저장 → 로그 삭제 → 재계산
           (사유 필수, dgflow_production_log_history에 기록)
```

---

## 4. 데이터베이스 설계

### 4.1 ER 다이어그램 (주요 관계)

```
dgflow_customers ─1:N─ dgflow_sites
       │                     │
       └──────1:N─ dgflow_orders ─1:N─ dgflow_order_items
                        │                     │
                        │              dgflow_order_attachments
                        │
                   dgflow_approvals
                   dgflow_approval_tokens
                   dgflow_order_status_logs
                        │
                   dgflow_work_orders ─1:N─ dgflow_work_order_items
                        │                           │
                   dgflow_cutting_logs        dgflow_production_logs
                                                    │
                                         dgflow_production_log_history

dgflow_users (auth 연동)
dgflow_products ─1:N─ dgflow_product_name_mappings
dgflow_raw_glasses (원판 마스터)
dgflow_notifications
```

### 4.2 테이블 상세 (18개)

#### 마스터 테이블

**dgflow_users** — 사용자
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| auth_id | uuid | Supabase Auth UID |
| email | text | 로그인 이메일 |
| name | text | 이름 |
| role | text | construction_mgr / biz_support / admin / production_mgr / system_admin |
| department | text | 부서명 |
| is_active | boolean | 활성 여부 |

**dgflow_customers** — 거래처
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| name | text | 정식 명칭 |
| short_name | text | 약칭 (목록 표시용) |
| contact_info | text | 연락처 |
| is_active | boolean | |

**dgflow_sites** — 현장
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| customer_id | uuid FK | 거래처 |
| site_name | text | 현장명 |
| address | text | 주소 |
| region_sido | text | 시/도 |
| region_sigungu | text | 시/군/구 |
| is_active | boolean | |

**dgflow_products** — 품명 마스터
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| product_code | text | 제품 코드 |
| display_name | text | 표시명 |
| erp_name | text | ERP 품명 |
| thickness_mm | numeric | 두께 |
| outer_glass | text | 외판 유리 |
| spacer | text | 스페이서 |
| gas | text | 가스 충전 |
| inner_glass | text | 내판 유리 |
| lamination_type | text | 접합 유형 |
| is_active | boolean | |

**dgflow_product_name_mappings** — 품명 변환 (발주서 → ERP)
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| product_id | uuid FK | 제품 |
| variant_name | text | 발주서에 표기되는 다양한 품명 |

**dgflow_raw_glasses** — 원판 마스터
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| glass_type | text | 유리 종류 |
| width_mm | integer | 원판 가로 |
| height_mm | integer | 원판 세로 |
| area_m2 | numeric | 면적 (자동 계산) |
| is_active | boolean | |

#### 주문 테이블

**dgflow_orders** — 주문 헤더
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_number | text | 주문번호 ({YYMMDD}-{일련번호}) |
| customer_id | uuid FK | 거래처 |
| site_id | uuid FK | 현장 |
| created_by | uuid FK | 작성자 |
| order_date | date | 주문일 |
| delivery_date | date | 납품 요청일 |
| status | text | 14단계 상태값 |
| total_quantity | integer | 총 수량 |
| total_area_m2 | numeric | 총 면적 |
| remark | text | 비고 |

**dgflow_order_items** — 주문 품목
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_id | uuid FK | 주문 |
| product_id | uuid FK | 품명 마스터 (매핑 시) |
| product_name | text | 품명 (원본 텍스트) |
| width_mm | integer | 가로 |
| height_mm | integer | 세로 |
| quantity | integer | 수량 |
| area_m2 | numeric | 면적 (가로x세로x수량/1,000,000) |
| location_dong | text | 위치: 동 |
| location_floor | text | 위치: 층 |
| location_room | text | 위치: 호 |
| location_type | text | 위치: 유형 |
| location_window_type | text | 위치: 창호 유형 |
| remark | text | 비고 (실리콘 색상 등) |
| sort_order | integer | 정렬 순서 |

**dgflow_order_attachments** — 주문 첨부파일
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_id | uuid FK | 주문 |
| file_name | text | 파일명 |
| file_path | text | Storage 경로 |
| file_size | integer | 파일 크기 (bytes) |
| mime_type | text | MIME 타입 |
| category | text | 분류 (purchase_order 등) |
| uploaded_by | uuid FK | 업로더 |

#### 승인 테이블

**dgflow_approvals** — 승인 이력
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_id | uuid FK | 주문 |
| step | text | 승인 단계 (customer/review/final) |
| status | text | approved / rejected |
| approved_by | uuid | 승인자 |
| comment | text | 코멘트 |

**dgflow_approval_tokens** — 고객 승인 토큰
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_id | uuid FK | 주문 |
| token | uuid | 비로그인 승인 URL 토큰 |
| expires_at | timestamptz | 만료 시각 |
| used_at | timestamptz | 사용 시각 |

**dgflow_order_status_logs** — 상태 변경 이력
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_id | uuid FK | 주문 |
| from_status | text | 이전 상태 |
| to_status | text | 변경 상태 |
| changed_by | uuid | 변경자 |
| comment | text | 코멘트 |

#### 작업의뢰서/생산 테이블

**dgflow_work_orders** — 작업의뢰서 헤더
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| order_id | uuid FK (nullable) | 주문 (바이투 업로드 시 NULL) |
| work_order_number | text | 의뢰번호 ({YY}-{4자리}) |
| request_date | date | 의뢰일 |
| delivery_date | date | 납품일 |
| status | text | pending / in_progress / completed |
| customer_name | text | 거래처명 (바이투 업로드 시 자체 저장) |
| site_name | text | 현장명 (바이투 업로드 시 자체 저장) |
| source | text | 'order' 또는 'upload' |

**dgflow_work_order_items** — 작업의뢰서 품목
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| work_order_id | uuid FK | 작업의뢰서 |
| product_id | uuid FK | 품명 마스터 |
| product_name | text | 품명 |
| width_mm | integer | 가로 |
| height_mm | integer | 세로 |
| quantity | integer | 의뢰 수량 |
| area_m2 | numeric | 면적 |
| produced_quantity | integer | 생산완료 수량 (로그 합계로 재계산) |
| thickness | numeric | 두께 |
| remark | text | 비고 |
| sort_order | integer | 정렬 순서 |

**dgflow_production_logs** — 생산실적 로그
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| work_order_id | uuid FK | 작업의뢰서 |
| work_order_item_id | uuid FK | 품목 |
| production_date | date | 생산일 |
| log_type | text | partial(부분) / full(전량완료) |
| quantity_completed | integer | 생산 수량 |
| area_m2 | numeric | 생산 면적 |
| shift | text | day(주간) / night(야간) |
| line_number | integer | 호기 (1, 2) |
| remark | text | 비고 |
| created_by | uuid FK | 입력자 |
| updated_by | uuid FK | 수정자 |
| updated_at | timestamptz | 수정 시각 |

**dgflow_production_log_history** — 생산실적 변경이력
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| production_log_id | uuid | 대상 로그 ID |
| action | text | update / delete |
| old_quantity | integer | 변경 전 수량 |
| new_quantity | integer | 변경 후 수량 (삭제 시 NULL) |
| reason | text | 변경 사유 (필수) |
| changed_by | uuid FK | 변경자 |
| changed_at | timestamptz | 변경 시각 |

**dgflow_cutting_logs** — 재단실적 로그
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| work_order_id | uuid FK | 작업의뢰서 |
| cutting_date | date | 재단일 |
| product_name | text | 품명 |
| quantity | integer | 재단 수량 |
| area_m2 | numeric | 재단 면적 |
| raw_glass_type | text | 원판 종류 |
| raw_width_mm | integer | 원판 가로 |
| raw_height_mm | integer | 원판 세로 |
| raw_quantity | integer | 원판 사용 수량 |
| raw_area_m2 | numeric | 원판 사용 면적 |
| shift | text | 주간/야간 |
| is_manual | boolean | 수동 재단 여부 |

**dgflow_notifications** — 알림
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | uuid PK | |
| user_id | uuid FK | 수신자 |
| type | text | 알림 유형 |
| message | text | 알림 메시지 |
| order_id | uuid FK | 관련 주문 |
| is_read | boolean | 읽음 여부 |

### 4.3 RLS 정책

모든 테이블: `auth.uid() IS NOT NULL` (인증된 사용자 접근 허용)
역할 기반 접근 제어는 애플리케이션 레벨에서 처리 (RLS 재귀 방지)

---

## 5. 페이지 구조

### 5.1 페이지 목록

```
app/
├── (authenticated)/          # 인증 필요 영역 (layout에서 세션 체크)
│   ├── layout.tsx            # 사이드바 + 헤더 + 인증 체크
│   ├── dashboard/            # 대시보드 (요약 카드, 파이프라인, 차트)
│   ├── orders/               # 주문 관리
│   │   ├── page.tsx          # 주문 목록 (검색/필터, 페이지네이션)
│   │   ├── new/              # 새 주문 작성 (엑셀 업로드 또는 수기)
│   │   └── [id]/
│   │       ├── page.tsx      # 주문 상세 (상태 변경, 승인 링크)
│   │       ├── edit/         # 주문 수정
│   │       ├── preview/      # 주문의뢰서 미리보기 (인쇄/엑셀)
│   │       └── erp-preview/  # ERP 엑셀 미리보기
│   ├── review/               # 검토 대기 목록 (경영지원팀)
│   ├── approve/              # 승인 대기 목록 (관리자)
│   ├── work-orders/          # 작업의뢰서 목록 (검색/필터)
│   │   └── [id]/             # 작업의뢰서 상세 (진행률, 품목, 이력)
│   ├── production/           # 생산현황 목록
│   │   └── [id]/             # 생산실적 입력 (수정/삭제 + 변경이력)
│   ├── cutting/
│   │   └── [id]/             # 재단실적 입력
│   ├── notifications/        # 알림 전체 목록
│   └── admin/                # 관리 (사용자, 마스터 데이터)
└── login/                    # 로그인 페이지
```

### 5.2 주요 화면 설명

**대시보드**
- 주문 요약 카드 4종 (전체주문, 처리대기, 이번달수량, 이번달면적)
- 작업의뢰서 요약 카드 4종 (전체, 대기, 진행중, 완료 + 바이투 건수)
- 주문 상태 파이프라인 (14단계 현황)
- 최근 30일 주문 추이 차트
- 납기 임박 주문/작업의뢰서 (7일 이내)
- 거래처별 주문 현황 Top 5

**주문 목록**
- 검색: 주문번호, 거래처, 현장, 작성자
- 필터: 상태 그룹별 (작성/고객승인/검토승인/승인완료/생산)
- 페이지네이션 (20건)

**작업의뢰서 목록**
- 검색: 의뢰번호, 거래처, 현장
- 필터: 상태 (대기/진행중/완료), 구분 (주문/바이투)
- 페이지네이션 (20건)

**생산실적 입력**
- 공통 옵션: 생산일자, 주/야간, 호기
- 품목별 수량 입력 → 전체 저장 / 전량완료
- 일별 생산 이력 (펼침/접힘 → 개별 로그 수정/삭제, 사유 필수)

---

## 6. API 설계

### 6.1 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/orders | 주문 생성 |
| PUT | /api/orders | 주문 수정 |
| DELETE | /api/orders | 주문 삭제 (본인만) |
| POST | /api/orders/status | 상태 변경 (검토/승인/반려) |
| GET | /api/approvals/token | 고객 승인 토큰 조회 |
| POST | /api/approvals/customer | 고객 승인/반려 (비로그인) |
| POST | /api/production | 생산실적 입력 |
| PUT | /api/production | 생산실적 수정 (사유 필수) |
| DELETE | /api/production | 생산실적 삭제 (사유 필수) |
| POST | /api/cutting | 재단실적 입력 |
| POST | /api/work-orders/upload | 바이투 작업의뢰서 엑셀 업로드 |
| GET | /api/notifications | 알림 목록 (벨 아이콘, 30초 폴링) |
| POST | /api/notifications/read | 알림 읽음 처리 |
| CRUD | /api/customers | 거래처 관리 |
| CRUD | /api/products | 품명 관리 |

### 6.2 인증/인가 패턴

```typescript
// 모든 API 공통
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// 역할 체크가 필요한 경우
if (!hasPermission(user.role, 'orders:create')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// DB 접근은 createServiceRoleClient() 사용 (RLS 우회)
const supabase = createServiceRoleClient();
```

---

## 7. 권한 설계

### 7.1 역할 정의

| 코드 | 이름 | 대상 |
|------|------|------|
| construction_mgr | 공사관리부 | 현장 담당자 (주문 작성) |
| biz_support | 경영지원팀 | 주문 검토, 마스터 관리 |
| admin | 관리자 | 최종 승인/반려/취소 |
| production_mgr | 생산관리팀 | 생산/재단 실적 입력 |
| system_admin | 시스템관리자 | 전체 권한 |

### 7.2 기능별 권한 매트릭스

| 기능 | construction_mgr | biz_support | admin | production_mgr | system_admin |
|------|:---:|:---:|:---:|:---:|:---:|
| 주문 생성 | O (본인) | - | - | - | O |
| 주문 수정 | O (본인) | O | - | - | O |
| 주문 삭제 | O (본인) | - | - | - | O |
| 주문 조회 | O | O | O | O | O |
| 검토 | - | O | - | - | O |
| 최종 승인/반려 | - | - | O | - | O |
| 승인 취소 | - | - | O | - | O |
| 생산실적 입력 | - | - | - | O | O |
| 재단실적 입력 | - | - | - | O | O |
| 마스터 관리 | - | O | - | - | O |
| 사용자 관리 | - | - | - | - | O |

---

## 8. 엑셀 연동

### 8.1 발주서 파싱 (입력)

6종 발주서 양식을 자동 파싱하여 주문 품목으로 변환.

```
파싱 로직: lib/parser/excel-order.ts

1. 헤더 탐색 (최대 20행, 병합 셀 대응)
2. 기본정보 추출 (거래처, 현장, 날짜, 납기)
3. 품목 행 파싱 (품명, 가로, 세로, 수량, 비고)
4. 품명 병합 셀 처리 (빈 품명 → 이전 행 상속)
5. 품명 매핑 (dgflow_product_name_mappings)
6. 면적 자동 계산
```

### 8.2 바이투 작업의뢰서 파싱 (입력)

```
파싱 로직: lib/parser/work-order-excel.ts

1. 27열 바이투 양식 파싱
2. 의뢰번호별 그룹핑 (1 파일 → N개 작업의뢰서)
3. 주문 없이 독립 생성 (order_id = NULL)
```

### 8.3 ERP 엑셀 출력

```
출력 로직: lib/erp/excel-export.ts

16열 ERP 양식으로 변환:
- 규격 그룹핑 (동일 품명+규격 합산)
- 주문번호 자동 채번
- 품명 매핑 (표시명 → ERP명)
```

---

## 9. 알림 시스템

### 9.1 알림 생성 시점

| 이벤트 | 수신자 | 메시지 예시 |
|--------|--------|------------|
| 주문 작성완료 | 경영지원팀 | "A건설 - OO현장 주문이 작성완료되었습니다" |
| 고객 승인/반려 | 작성자 | "A건설 - OO현장 주문이 고객 승인되었습니다" |
| 검토 완료 | 관리자 | "A건설 - OO현장 주문 검토가 완료되었습니다" |
| 최종 승인 | 작성자, 생산팀 | "A건설 - OO현장 주문이 최종 승인되었습니다" |
| 반려 | 작성자 | "A건설 - OO현장 주문이 반려되었습니다" |

### 9.2 알림 전달

- 헤더 벨 아이콘 (30초 폴링)
- 미읽음 카운트 뱃지
- 알림 전체 목록 페이지
- (향후) 이메일 알림 (Resend 연동)

---

## 10. 프로젝트 구조

```
dongil-ax/
├── app/
│   ├── (authenticated)/      # 인증 필요 페이지
│   ├── api/                  # API 라우트
│   └── login/                # 로그인
├── components/
│   ├── ui/                   # shadcn/ui 공통 컴포넌트
│   ├── layout/               # 사이드바, 헤더
│   ├── dashboard/            # 대시보드 전용 (차트 등)
│   ├── order/                # 주문 관련 (검색필터, 폼)
│   ├── review/               # 검토 관련
│   └── work-order/           # 작업의뢰서 관련 (업로드, 검색)
├── lib/
│   ├── auth/                 # getCurrentUser, role-guard
│   ├── supabase/             # client.ts, server.ts
│   ├── parser/               # excel-order.ts, work-order-excel.ts
│   ├── erp/                  # excel-export.ts
│   ├── export/               # 주문의뢰서 엑셀 출력
│   ├── calc/                 # 면적 계산
│   ├── notification/         # 알림 생성 유틸
│   └── utils.ts              # 공통 유틸
├── types/
│   ├── order-status.ts       # 주문 상태 상수, 전이 규칙, 색상
│   └── user.ts               # 역할 상수
├── __tests__/                # 테스트 (16건)
├── supabase/
│   └── migrations/           # DB 마이그레이션 SQL
├── data/                     # 문서, 참고 자료
├── scripts/                  # db.mjs 등 유틸 스크립트
└── CLAUDE.md                 # AI 개발 컨텍스트
```

---

## 11. 해결된 설계 이슈

| 이슈 | 원인 | 해결 |
|------|------|------|
| middleware 인증 실패 | Next.js 16 + Supabase SSR 호환 문제 | layout.tsx에서 인증 체크 |
| RLS 무한 재귀 | dgflow_users 서브쿼리 루프 | `auth.uid() IS NOT NULL`로 단순화 |
| 작업의뢰서/생산 API 실패 | anon key로 work_order_items 접근 불가 | `createServiceRoleClient()` 사용 |
| 생산실적 저장 미반영 | 위와 동일 + 에러 무시 | ServiceRoleClient + 에러 핸들링 |
| produced_quantity 정합성 | 개별 덧셈 방식의 누적 오류 가능성 | 로그 합계 재계산 방식으로 변경 |
| shadcn Select 표시 오류 | @base-ui Select가 value 그대로 표시 | 네이티브 `<select>` 사용 |
| 엑셀 파서 병합 셀 | 품명이 병합되어 하위 행이 빈 값 | 이전 행 품명 상속 로직 |

---

## 12. 향후 확장 계획

### 검토 중

| 영역 | 설명 | 상태 |
|------|------|------|
| 매출 관리 | 주문 품목에 단가/금액 추가, 매출 대시보드 | 검토 자료 작성 완료 |
| 원가 관리 | 원판/가공/부자재 단가 마스터, 마진 분석 | 검토 자료 작성 완료 |
| 원판 재고 | 입출고 관리, 재단 시 자동 차감 | 구상 단계 |
| 출하/배송 | 생산완료 → 출하지시 → 배송 → 납품확인 | 구상 단계 |

### 백로그

- Vercel 프로덕션 배포 설정
- 주간생산일지 집계/엑셀 출력
- 대시보드 필터링 (기간별, 지역별)
- LLM 보조 파싱 (미매칭 품명 추천)
- 알림 이메일 발송 (Resend)
- 견적 관리, 품질관리 (QC), 생산 스케줄링
