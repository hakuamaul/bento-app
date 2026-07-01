import { describe, it, expect } from "vitest";
import { buildCsvContent } from "../lib/export-csv";
import type { Reservation, OrderItem } from "../types/reservation";

const sampleOrderItems: OrderItem[] = [
  {
    menuId: "tamago_don",
    menuName: "玉子丼",
    price: 450,
    quantity: 2,
  },
  {
    menuId: "rice_normal",
    menuName: "主食（ごはん）",
    price: 190,
    quantity: 1,
  },
];

const sampleReservations: Reservation[] = [
  {
    id: "abc123",
    studentName: "山田 太郎",
    grade: "1年",
    pickupDate: "2026-04-10",
    orderItems: sampleOrderItems,
    totalPrice: 1090,
    notes: "",
    createdAt: "2026-04-08T09:00:00.000Z",
    status: "confirmed",
    paymentStatus: "unpaid",
  },
  {
    id: "def456",
    studentName: "鈴木 花子",
    grade: "2年",
    pickupDate: "2026-04-11",
    orderItems: [
      {
        menuId: "onigiri_bento",
        menuName: "2個入おにぎり弁当",
        price: 420,
        quantity: 1,
      },
    ],
    totalPrice: 420,
    notes: "卵アレルギーあり",
    createdAt: "2026-04-08T10:00:00.000Z",
    status: "confirmed",
    paymentStatus: "unpaid",
  },
];

describe("buildCsvContent", () => {
  it("BOMで始まる", () => {
    const csv = buildCsvContent(sampleReservations);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("ヘッダー行が正しい", () => {
    const csv = buildCsvContent(sampleReservations);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "予約ID,学生名,学年,受け取り日,メニュー（複数の場合は；で区切り）,合計金額,備考,予約日時,ステータス"
    );
  });

  it("データ行数が正しい", () => {
    const csv = buildCsvContent(sampleReservations);
    const lines = csv.slice(1).split("\r\n").filter(Boolean);
    // header + 2 data rows
    expect(lines.length).toBe(3);
  });

  it("学生名が含まれる", () => {
    const csv = buildCsvContent(sampleReservations);
    expect(csv).toContain("山田 太郎");
    expect(csv).toContain("鈴木 花子");
  });

  it("複数メニューが；で区切られる", () => {
    const csv = buildCsvContent(sampleReservations);
    expect(csv).toContain("玉子丼×2；主食（ごはん）×1");
  });

  it("合計金額が正しく出力される", () => {
    const csv = buildCsvContent(sampleReservations);
    expect(csv).toContain("1090");
    expect(csv).toContain("420");
  });

  it("備考にカンマが含まれる場合はクォートされる", () => {
    const r: Reservation = {
      ...sampleReservations[0],
      notes: "卵,乳製品アレルギー",
    };
    const csv = buildCsvContent([r]);
    expect(csv).toContain('"卵,乳製品アレルギー"');
  });

  it("空の予約リストでもヘッダーのみ出力される", () => {
    const csv = buildCsvContent([]);
    const lines = csv.slice(1).split("\r\n").filter(Boolean);
    expect(lines.length).toBe(1); // header only
  });

  it("ステータスが日本語に変換される", () => {
    const csv = buildCsvContent(sampleReservations);
    expect(csv).toContain("確定");
  });
});
