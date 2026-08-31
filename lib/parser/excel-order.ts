import * as XLSX from 'xlsx';

export interface ParsedOrderMeta {
  customer_name: string;
  site_name: string;
  order_date: string;
  delivery_date: string;
  remark: string;
}

export interface ParsedOrderItem {
  product_name: string;
  width_mm: string;
  height_mm: string;
  quantity: string;
  location_dong: string;
  location_line: string;
  location_floor: string;
  location_room: string;
  location_type: string;
  location_window_type: string;
  remark: string;
}

// 컬럼명 매핑 (다양한 엑셀 양식 대응)
const COLUMN_ALIASES: Record<string, string[]> = {
  product_name: ['품명', '제품명', '품목', '기타(품명)', '기타', '재료종류', '유리종류', '종류', '제품명', '외판/내판', '주문내'],
  width_mm: ['가로', '가로규격', '가로(mm)', 'W', 'width', '폭'],
  height_mm: ['세로', '세로규격', '세로(mm)', 'H', 'height', '높이'],
  quantity: ['수량', '주문수량', '합계', 'EA', 'QTY', 'qty', '매수', '수량'],
  location_dong: ['동', '동호'],
  location_line: ['라인', 'LINE'],
  location_floor: ['층', '층수', 'F', 'FLOOR', '호수'],
  location_room: ['위치', '창위치', '실명', '실', '위치/비고'],
  location_type: ['타입', 'TYPE', '세대타입'],
  location_window_type: ['창구분', '내외창', '구분'],
  remark: ['비고', '비고1', '참고', 'REMARK', '메모', '실리콘'],
};

/**
 * 엑셀 파일을 파싱하여 주문 품목 배열을 반환
 */
export function parseOrderExcel(buffer: ArrayBuffer): {
  meta: ParsedOrderMeta;
  items: ParsedOrderItem[];
  sheetName: string;
  totalRows: number;
  warnings: string[];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const warnings: string[] = [];

  // 첫 번째 시트 또는 가장 데이터가 많은 시트 선택
  let bestSheet = wb.SheetNames[0];
  let bestRows = 0;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (data.length > bestRows) {
      bestRows = data.length;
      bestSheet = name;
    }
  }

  const ws = wb.Sheets[bestSheet];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  // 엑셀 상단 영역에서 기본정보 추출
  const allRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  const meta = extractMeta(allRows);

  if (rawData.length === 0) {
    return { meta, items: [], sheetName: bestSheet, totalRows: 0, warnings: ['데이터가 없습니다.'] };
  }

  // 컬럼 매핑 탐색
  const headers = Object.keys(rawData[0]);
  const columnMap = findColumnMapping(headers);

  if (!columnMap.product_name && !columnMap.width_mm) {
    // 헤더가 1행이 아닐 수 있음 - 처음 10행에서 헤더 탐색
    for (let i = 0; i < Math.min(20, allRows.length); i++) {
      const row = allRows[i];
      if (!Array.isArray(row)) continue;
      const rowHeaders = row.map(String);
      const testMap = findColumnMapping(rowHeaders);
      if (testMap.product_name || testMap.width_mm) {
        const reParsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: i, defval: '' });
        const result = parseRows(reParsed, bestSheet, warnings);
        return { ...result, meta };
      }

      // "규격" 컬럼 안에 두께/가로/세로가 병합된 경우 (김길홍 양식)
      const hasSpec = rowHeaders.some(h => /규\s*격/.test(h));
      const hasProduct = rowHeaders.some(h => /제\s*품\s*명|위\s*치/.test(h));
      if (hasSpec || hasProduct) {
        const reParsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: i, defval: '' });
        const result = parseRows(reParsed, bestSheet, warnings);
        return { ...result, meta };
      }
    }
    warnings.push('품명/가로/세로 컬럼을 찾을 수 없습니다. 수동으로 확인해주세요.');
    return { meta, items: [], sheetName: bestSheet, totalRows: rawData.length, warnings };
  }

  const result = parseRows(rawData, bestSheet, warnings);
  return { ...result, meta };
}

/**
 * 엑셀 상단 영역에서 기본정보(거래처, 현장, 날짜 등) 추출
 * 발주서는 보통 상단 1~10행에 메타 정보가 있음
 */
function extractMeta(rows: string[][]): ParsedOrderMeta {
  const meta: ParsedOrderMeta = {
    customer_name: '',
    site_name: '',
    order_date: '',
    delivery_date: '',
    remark: '',
  };

  const META_PATTERNS: Record<string, { keywords: string[]; field: keyof ParsedOrderMeta }> = {
    customer: { keywords: ['업체', '거래처', '발주자', '수신', '고객', '시공사', '업체명'], field: 'customer_name' },
    site: { keywords: ['현장', '공사명', '현장명', 'Project명', '프로젝트'], field: 'site_name' },
    order_date: { keywords: ['주문일', '발주일', '의뢰일', '작성일', '날짜', '발주일자', '의뢰일자', '주문서발송일'], field: 'order_date' },
    delivery_date: { keywords: ['납품일', '출고일', '납기일', '납품일자', '납기', '납기일자', '현장납기일'], field: 'delivery_date' },
  };

  // 상단 15행만 스캔
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      if (!cell) continue;

      for (const { keywords, field } of Object.values(META_PATTERNS)) {
        if (meta[field]) continue; // 이미 찾은 경우 건너뛰기

        const isLabel = keywords.some(kw => cell.includes(kw));
        if (isLabel) {
          // 다음 셀에 값이 있을 가능성
          const nextCell = String(row[j + 1] ?? '').trim();
          // 또는 같은 셀에 "라벨: 값" 형식
          const colonSplit = cell.split(/[:：]/);

          if (nextCell && nextCell.length > 1) {
            meta[field] = formatMetaValue(nextCell, field);
          } else if (colonSplit.length > 1 && colonSplit[1].trim()) {
            meta[field] = formatMetaValue(colonSplit[1].trim(), field);
          } else {
            // 아래 행에 값이 있을 수 있음
            const belowRow = rows[i + 1];
            if (belowRow && belowRow[j]) {
              meta[field] = formatMetaValue(String(belowRow[j]).trim(), field);
            }
          }
        }
      }
    }
  }

  return meta;
}

function formatMetaValue(value: string, field: keyof ParsedOrderMeta): string {
  if (field === 'order_date' || field === 'delivery_date') {
    // Excel 시리얼 번호 (예: 45894 → 2025-09-12)
    const num = Number(value);
    if (!isNaN(num) && num > 40000 && num < 60000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    // Date 객체
    const date = new Date(value);
    if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
      return date.toISOString().split('T')[0];
    }
    // YYYY.MM.DD 또는 YYYY-MM-DD 패턴
    const match = value.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }
  }
  return value;
}

function parseRows(
  rawData: Record<string, unknown>[],
  sheetName: string,
  warnings: string[]
): { items: ParsedOrderItem[]; sheetName: string; totalRows: number; warnings: string[] } {
  const headers = Object.keys(rawData[0] || {});
  // 첫 행이 하위 헤더(두께/가로/세로 등)일 수 있으므로 전달
  const columnMap = findColumnMapping(headers, rawData[0] as Record<string, unknown>);

  const items: ParsedOrderItem[] = [];

  for (const row of rawData) {
    const productName = getString(row, columnMap.product_name);
    const width = getNumber(row, columnMap.width_mm);
    const height = getNumber(row, columnMap.height_mm);
    const quantity = getNumber(row, columnMap.quantity);

    // 빈 행이나 소계/합계 행 건너뛰기
    if (!productName && !width && !height) continue;
    if (productName && /합계|소계|TOTAL|SUM/i.test(productName)) continue;
    if (width <= 0 || height <= 0) continue;

    items.push({
      product_name: productName,
      width_mm: width > 0 ? String(width) : '',
      height_mm: height > 0 ? String(height) : '',
      quantity: quantity > 0 ? String(quantity) : '1',
      location_dong: getString(row, columnMap.location_dong),
      location_line: getString(row, columnMap.location_line),
      location_floor: getString(row, columnMap.location_floor),
      location_room: getString(row, columnMap.location_room),
      location_type: getString(row, columnMap.location_type),
      location_window_type: getString(row, columnMap.location_window_type),
      remark: getString(row, columnMap.remark),
    });
  }

  if (items.length === 0) {
    warnings.push('유효한 품목 데이터가 없습니다. 가로/세로 값이 있는 행만 인식됩니다.');
  }

  return { items, sheetName, totalRows: rawData.length, warnings };
}

function findColumnMapping(headers: string[], firstDataRow?: Record<string, unknown>): Record<string, string> {
  const map: Record<string, string> = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const header of headers) {
      const normalized = header.replace(/\s+/g, '').toLowerCase();
      for (const alias of aliases) {
        if (normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())) {
          map[field] = header;
          break;
        }
      }
      if (map[field]) break;
    }
  }

  // __EMPTY 컬럼 처리: 첫 데이터 행의 값으로 컬럼 의미 파악
  if (firstDataRow) {
    for (const header of headers) {
      if (!header.startsWith('__EMPTY')) continue;
      const val = String(firstDataRow[header] ?? '').replace(/\s+/g, '').toLowerCase();
      if (!map.width_mm && (val === '가로' || val.includes('가로'))) map.width_mm = header;
      else if (!map.height_mm && (val === '세로' || val.includes('세로'))) map.height_mm = header;
      else if (!map.quantity && (val === '수량' || val.includes('수량') || val === '합계' || val.includes('합계'))) map.quantity = header;
    }
  }

  return map;
}

function getString(row: Record<string, unknown>, column: string | undefined): string {
  if (!column) return '';
  const val = row[column];
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function getNumber(row: Record<string, unknown>, column: string | undefined): number {
  if (!column) return 0;
  const val = row[column];
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : Math.round(num);
}
