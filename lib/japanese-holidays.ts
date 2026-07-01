/**
 * 日本の祝日データ管理モジュール（WebCORSエラー対策・完全版）
 * 出典：https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
 */

import { Platform } from "react-native"; // ★ウェブ環境を判定するために追加

// ─────────────────────────────────────────────
// フォールバックデータ（2025〜2027年）
// ─────────────────────────────────────────────
const FALLBACK_HOLIDAYS = new Set<string>([
  // 2025年
  "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24",
  "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05",
  "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23",
  "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",

  // 2026年（今年）
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
  "2026-10-12", "2026-11-03", "2026-11-23",

  // 2027年
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
  "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
  "2027-11-03", "2027-11-23",
]);

let _dynamicHolidays: Set<string> | null = null;
let _dataSource: "network" | "cache" | "fallback" = "fallback";

export function setHolidayDates(
  dates: string[],
  source: "network" | "cache" | "fallback"
): void {
  _dynamicHolidays = new Set(dates);
  _dataSource = source;
}

export function getHolidayDataSource(): "network" | "cache" | "fallback" {
  return _dataSource;
}

/**
 * 現在アクティブな祝日セットを返す。
 * ★大改造：Web版（Netlify）の時は、CORSエラーによるフリーズを完全に防ぐため、
 * 外部への通信結果を見無視して、100%信頼できる手元のデータを強制的に使用する。
 */
function getActiveHolidaySet(): Set<string> {
  if (Platform.OS === "web") {
    return FALLBACK_HOLIDAYS;
  }
  return _dynamicHolidays ?? FALLBACK_HOLIDAYS;
}

// ─────────────────────────────────────────────
// 公開ユーティリティ関数
// ─────────────────────────────────────────────

export function isJapaneseHoliday(dateStr: string): boolean {
  return getActiveHolidaySet().has(dateStr);
}

export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function isBusinessDay(dateStr: string): boolean {
  const d = parseDateLocal(dateStr);
  const day = d.getDay();
  if (day === 0 || day === 6) return false; // 土日
  if (isJapaneseHoliday(dateStr)) return false; // 祝日
  return true;
}