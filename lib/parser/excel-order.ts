import * as XLSX from 'xlsx';

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
  product_name: ['품명', '제품명', '품목', '기타(품명)', '기타', '재료종류', '유리종류', '종류'],
  width_mm: ['가로', '가로규격', '가로(mm)', 'W', 'width', '폭'],
  height_mm: ['세로', '세로규격', '세로(mm)', 'H', 'height', '높이'],
  quantity: ['수량', '주문수량', '합계', 'EA', 'QTY', 'qty', '매수'],
  location_dong: ['동', '동호'],
  location_line: ['라인', 'LINE'],
  location_floor: ['층', '층수', 'F', 'FLOOR', '호수'],
  location_room: ['위치', '창위치', '실명', '실'],
  location_type: ['타입', 'TYPE', '세대타입'],
  location_window_type: ['창구분', '내외창', '구분'],
  remark: ['비고', '비고1', '참고', 'REMARK', '메모'],
};

/**
 * 엑셀 파일을 파싱하여 주문 품목 배열을 반환
 */
export function parseOrderExcel(buffer: ArrayBuffer): {
  items: ParsedOrderItem[];
  sheetName: string;
  totalRows: number;
  warnings: string[];
} {
  const wb = XLSX.read(buffer, { type: 'array' });
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

  if (rawData.length === 0) {
    return { items: [], sheetName: bestSheet, totalRows: 0, warnings: ['데이터가 없습니다.'] };
  }

  // 컬럼 매핑 탐색
  const headers = Object.keys(rawData[0]);
  const columnMap = findColumnMapping(headers);

  if (!columnMap.product_name && !columnMap.width_mm) {
    // 헤더가 1행이 아닐 수 있음 - 처음 10행에서 헤더 탐색
    const allData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
    for (let i = 0; i < Math.min(10, allData.length); i++) {
      const row = allData[i];
      if (!Array.isArray(row)) continue;
      const rowHeaders = row.map(String);
      const testMap = findColumnMapping(rowHeaders);
      if (testMap.product_name || testMap.width_mm) {
        // i행이 헤더 → i+1부터 데이터
        const reParsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: i, defval: '' });
        return parseRows(reParsed, bestSheet, warnings);
      }
    }
    warnings.push('품명/가로/세로 컬럼을 찾을 수 없습니다. 수동으로 확인해주세요.');
    return { items: [], sheetName: bestSheet, totalRows: rawData.length, warnings };
  }

  return parseRows(rawData, bestSheet, warnings);
}

function parseRows(
  rawData: Record<string, unknown>[],
  sheetName: string,
  warnings: string[]
): { items: ParsedOrderItem[]; sheetName: string; totalRows: number; warnings: string[] } {
  const headers = Object.keys(rawData[0] || {});
  const columnMap = findColumnMapping(headers);

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

function findColumnMapping(headers: string[]): Record<string, string> {
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
