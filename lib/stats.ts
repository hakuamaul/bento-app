/**
 * stats.ts
 *
 * 予約データから食費統計を集計するユーティリティ。
 * グラフ画面で使用する月次・年次・全期間サマリーを提供する。
 */

import type { Reservation } from "@/types/reservation";

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export interface MonthlyStats {
  /** "YYYY-MM" 形式 */
  yearMonth: string;
  year: number;
  month: number;
  /** キャンセルを除く合計金額 */
  totalAmount: number;
  /** キャンセルを除く予約件数 */
  count: number;
  /** 支払い済み金額 */
  paidAmount: number;
  /** 未払い金額 */
  unpaidAmount: number;
}

export interface YearlyStats {
  year: number;
  /** 月ごとの統計（1〜12月、データがない月は 0 埋め） */
  months: MonthlyStats[];
  /** 年間合計金額 */
  totalAmount: number;
  /** 年間合計件数 */
  totalCount: number;
}

export interface OverallStats {
  /** 全期間合計金額 */
  totalAmount: number;
  /** 全期間合計件数 */
  totalCount: number;
  /** 利用開始年月 */
  firstYearMonth: string | null;
  /** 最新年月 */
  lastYearMonth: string | null;
  /** 月平均金額 */
  avgMonthlyAmount: number;
  /** データが存在する年のリスト（昇順） */
  years: number[];
  /** 利用期間の表示ラベル（例：　30日、31日以上は　30日、365日以上は　1年0ヶ月、など） */
  usagePeriodLabel: string;
}

// ─────────────────────────────────────────────
// 集計関数
// ─────────────────────────────────────────────

/**
 * 予約リストから月次統計マップを生成する。
 * キャンセル済みの予約は除外する。
 */
export function buildMonthlyStatsMap(
  reservations: Reservation[]
): Map<string, MonthlyStats> {
  const map = new Map<string, MonthlyStats>();

  for (const r of reservations) {
    if (r.status === "cancelled") continue;

    const date = r.pickupDate; // "YYYY-MM-DD"
    const yearMonth = date.slice(0, 7); // "YYYY-MM"
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));

    const existing = map.get(yearMonth) ?? {
      yearMonth,
      year,
      month,
      totalAmount: 0,
      count: 0,
      paidAmount: 0,
      unpaidAmount: 0,
    };

    existing.totalAmount += r.totalPrice;
    existing.count += 1;
    if (r.paymentStatus === "paid") {
      existing.paidAmount += r.totalPrice;
    } else {
      existing.unpaidAmount += r.totalPrice;
    }

    map.set(yearMonth, existing);
  }

  return map;
}

/**
 * 月次統計マップから年次統計リストを生成する。
 * 各年の 1〜12 月を 0 埋めで補完する。
 */
export function buildYearlyStats(
  monthlyMap: Map<string, MonthlyStats>,
  years: number[]
): YearlyStats[] {
  return years.map((year) => {
    const months: MonthlyStats[] = [];
    let totalAmount = 0;
    let totalCount = 0;

    for (let m = 1; m <= 12; m++) {
      const yearMonth = `${year}-${String(m).padStart(2, "0")}`;
      const stats = monthlyMap.get(yearMonth) ?? {
        yearMonth,
        year,
        month: m,
        totalAmount: 0,
        count: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      };
      months.push(stats);
      totalAmount += stats.totalAmount;
      totalCount += stats.count;
    }

    return { year, months, totalAmount, totalCount };
  });
}

/**
 * 予約リストから全期間サマリーを生成する。
 */
export function buildOverallStats(
  reservations: Reservation[],
  monthlyMap: Map<string, MonthlyStats>
): OverallStats {
  const active = reservations.filter((r) => r.status !== "cancelled");
  const totalAmount = active.reduce((sum, r) => sum + r.totalPrice, 0);
  const totalCount = active.length;

  const yearMonths = Array.from(monthlyMap.keys()).sort();
  const firstYearMonth = yearMonths[0] ?? null;
  const lastYearMonth = yearMonths[yearMonths.length - 1] ?? null;

  const monthsWithData = monthlyMap.size;
  const avgMonthlyAmount =
    monthsWithData > 0 ? Math.round(totalAmount / monthsWithData) : 0;

  const yearsSet = new Set<number>();
  for (const ym of yearMonths) {
    yearsSet.add(Number(ym.slice(0, 4)));
  }
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  const usagePeriodLabel = formatUsagePeriod(firstYearMonth, lastYearMonth);

  return {
    totalAmount,
    totalCount,
    firstYearMonth,
    lastYearMonth,
    avgMonthlyAmount,
    years,
    usagePeriodLabel,
  };
}

/**
 * 全集計を一括で実行するメイン関数。
 */
export function computeStats(reservations: Reservation[]): {
  monthly: Map<string, MonthlyStats>;
  yearly: YearlyStats[];
  overall: OverallStats;
} {
  const monthly = buildMonthlyStatsMap(reservations);
  const overall = buildOverallStats(reservations, monthly);
  const yearly = buildYearlyStats(monthly, overall.years);
  return { monthly, yearly, overall };
}

/**
 * 利用期間を人間が読みやすい形式に変換する。
 *
 * - 0日：「開始直後」
 * - 1日〜364日：「○日」
 * - 365日以上：「○年○ヶ月」（1ヶ月の場合は「○年1ヶ月」、○ヶ月が0の場合は「○年」）
 *
 * @param firstDate 利用開始日（YYYY-MM-DD形式またはDateオブジェクト）
 * @param lastDate  最終利用日（省略時は現在日）
 */
export function formatUsagePeriod(
  firstDate: string | Date | null,
  lastDate?: string | Date | null
): string {
  if (!firstDate) return "データなし";

  const toDate = (v: string | Date): Date => {
    if (v instanceof Date) return v;
    // "YYYY-MM" 形式の場合は月初に補完
    const s = v.length === 7 ? `${v}-01` : v;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const start = toDate(firstDate);
  const end = lastDate ? toDate(lastDate) : new Date();

  // 日数差（切り捨て）
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "開始直後";
  if (diffDays === 0) return "開始直後";
  if (diffDays < 365) return `${diffDays}日`;

  // 365日以上：年数と残り月数で表示
  const years = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;
  const months = Math.floor(remainingDays / 30);

  if (months === 0) return `${years}年`;
  return `${years}年${months}ヶ月`;
}

/**
 * 金額を日本円形式にフォーマットする（例: 1,234円）。
 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}
