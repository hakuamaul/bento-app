/**
 * stats.ts のテスト
 *
 * - 月次集計の正確性
 * - キャンセル除外
 * - 年次集計（0埋め補完）
 * - 全期間サマリー
 * - formatUsagePeriod（利用期間フォーマット）
 */

import { describe, it, expect } from "vitest";
import {
  buildMonthlyStatsMap,
  buildYearlyStats,
  buildOverallStats,
  computeStats,
  formatYen,
  formatUsagePeriod,
} from "@/lib/stats";
import type { Reservation } from "@/types/reservation";

// テスト用の予約データを生成するヘルパー
function makeReservation(
  overrides: Partial<Reservation> & {
    pickupDate: string;
    totalPrice: number;
  }
): Reservation {
  const { pickupDate, totalPrice, ...rest } = overrides;
  return {
    id: Math.random().toString(36).slice(2),
    studentName: "テスト太郎",
    grade: "2年",
    pickupDate,
    orderItems: [],
    totalPrice,
    notes: "",
    createdAt: new Date().toISOString(),
    status: "confirmed",
    paymentStatus: "unpaid",
    ...rest,
  };
}

describe("buildMonthlyStatsMap", () => {
  it("月次集計が正しく計算される", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2026-04-10", totalPrice: 500 }),
      makeReservation({ pickupDate: "2026-04-15", totalPrice: 600 }),
      makeReservation({ pickupDate: "2026-05-01", totalPrice: 700 }),
    ];
    const map = buildMonthlyStatsMap(reservations);

    expect(map.get("2026-04")?.totalAmount).toBe(1100);
    expect(map.get("2026-04")?.count).toBe(2);
    expect(map.get("2026-05")?.totalAmount).toBe(700);
    expect(map.get("2026-05")?.count).toBe(1);
  });

  it("キャンセル済みの予約は除外される", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2026-04-10", totalPrice: 500 }),
      makeReservation({
        pickupDate: "2026-04-15",
        totalPrice: 600,
        status: "cancelled",
      }),
    ];
    const map = buildMonthlyStatsMap(reservations);

    expect(map.get("2026-04")?.totalAmount).toBe(500);
    expect(map.get("2026-04")?.count).toBe(1);
  });

  it("支払い状態が正しく集計される", () => {
    const reservations: Reservation[] = [
      makeReservation({
        pickupDate: "2026-04-10",
        totalPrice: 500,
        paymentStatus: "paid",
      }),
      makeReservation({
        pickupDate: "2026-04-15",
        totalPrice: 600,
        paymentStatus: "unpaid",
      }),
    ];
    const map = buildMonthlyStatsMap(reservations);

    expect(map.get("2026-04")?.paidAmount).toBe(500);
    expect(map.get("2026-04")?.unpaidAmount).toBe(600);
  });

  it("データがない場合は空のマップを返す", () => {
    const map = buildMonthlyStatsMap([]);
    expect(map.size).toBe(0);
  });
});

describe("buildYearlyStats", () => {
  it("12ヶ月分のデータが0埋めで補完される", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2026-04-10", totalPrice: 500 }),
      makeReservation({ pickupDate: "2026-07-15", totalPrice: 600 }),
    ];
    const map = buildMonthlyStatsMap(reservations);
    const yearly = buildYearlyStats(map, [2026]);

    expect(yearly[0].months).toHaveLength(12);
    expect(yearly[0].months[0].totalAmount).toBe(0); // 1月
    expect(yearly[0].months[3].totalAmount).toBe(500); // 4月
    expect(yearly[0].months[6].totalAmount).toBe(600); // 7月
    expect(yearly[0].months[11].totalAmount).toBe(0); // 12月
  });

  it("年間合計が正しく計算される", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2026-04-10", totalPrice: 500 }),
      makeReservation({ pickupDate: "2026-07-15", totalPrice: 600 }),
    ];
    const map = buildMonthlyStatsMap(reservations);
    const yearly = buildYearlyStats(map, [2026]);

    expect(yearly[0].totalAmount).toBe(1100);
    expect(yearly[0].totalCount).toBe(2);
  });
});

describe("buildOverallStats", () => {
  it("全期間サマリーが正しく計算される", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2025-10-10", totalPrice: 500 }),
      makeReservation({ pickupDate: "2026-04-15", totalPrice: 600 }),
      makeReservation({ pickupDate: "2026-07-01", totalPrice: 700 }),
    ];
    const map = buildMonthlyStatsMap(reservations);
    const overall = buildOverallStats(reservations, map);

    expect(overall.totalAmount).toBe(1800);
    expect(overall.totalCount).toBe(3);
    expect(overall.firstYearMonth).toBe("2025-10");
    expect(overall.lastYearMonth).toBe("2026-07");
    expect(overall.years).toEqual([2025, 2026]);
    // 月平均: 1800 / 3ヶ月 = 600
    expect(overall.avgMonthlyAmount).toBe(600);
  });

  it("キャンセルは合計件数・金額から除外される", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2026-04-10", totalPrice: 500 }),
      makeReservation({
        pickupDate: "2026-04-15",
        totalPrice: 600,
        status: "cancelled",
      }),
    ];
    const map = buildMonthlyStatsMap(reservations);
    const overall = buildOverallStats(reservations, map);

    expect(overall.totalAmount).toBe(500);
    expect(overall.totalCount).toBe(1);
  });
});

describe("computeStats", () => {
  it("空の予約リストで正常に動作する", () => {
    const { monthly, yearly, overall } = computeStats([]);
    expect(monthly.size).toBe(0);
    expect(yearly).toHaveLength(0);
    expect(overall.totalAmount).toBe(0);
    expect(overall.years).toHaveLength(0);
  });

  it("複数年にまたがるデータを正しく集計する", () => {
    const reservations: Reservation[] = [
      makeReservation({ pickupDate: "2024-12-20", totalPrice: 500 }),
      makeReservation({ pickupDate: "2025-06-15", totalPrice: 600 }),
      makeReservation({ pickupDate: "2026-03-10", totalPrice: 700 }),
    ];
    const { overall, yearly } = computeStats(reservations);

    expect(overall.years).toEqual([2024, 2025, 2026]);
    expect(yearly).toHaveLength(3);
    expect(overall.totalAmount).toBe(1800);
  });
});

describe("formatYen", () => {
  it("金額を日本円形式にフォーマットする", () => {
    expect(formatYen(0)).toBe("0円");
    expect(formatYen(500)).toBe("500円");
    expect(formatYen(1234)).toBe("1,234円");
    expect(formatYen(12345)).toBe("12,345円");
  });
});

describe("formatUsagePeriod", () => {
  it("データなしの場合は「データなし」を返す", () => {
    expect(formatUsagePeriod(null)).toBe("データなし");
  });

  it("同日の場合は「開始直後」を返す", () => {
    expect(formatUsagePeriod("2026-01-01", "2026-01-01")).toBe("開始直後");
  });

  it("30日の場合は「30日」を返す", () => {
    // 2026-01-01 から 2026-01-31 = 30日差
    expect(formatUsagePeriod("2026-01-01", "2026-01-31")).toBe("30日");
  });

  it("364日の場合は「364日」を返す（365日未満）", () => {
    // 2025-01-01 から 2025-12-31 = 364日差
    expect(formatUsagePeriod("2025-01-01", "2025-12-31")).toBe("364日");
  });

  it("365日の場合は「1年」を返す", () => {
    // 2025-01-01 から 2026-01-01 = 365日差
    expect(formatUsagePeriod("2025-01-01", "2026-01-01")).toBe("1年");
  });

  it("1年1ヶ月の場合は「1年1ヶ月」を返す", () => {
    // 2025-01-01 から 2026-02-01 = 396日差 → 1年1ヶ月
    expect(formatUsagePeriod("2025-01-01", "2026-02-01")).toBe("1年1ヶ月");
  });
});
