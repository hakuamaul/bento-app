import { describe, it, expect, beforeEach } from "vitest";
import {
  loadReservations,
  saveReservations,
  addReservation,
  cancelReservation,
  markReservationPickedUp,
  markReservationPaid,
  getBusinessDayDeadline,
} from "../lib/reservation-store";
import type { Reservation } from "../types/reservation";

const sampleReservation: Reservation = {
  id: "test-id-1",
  studentName: "山田 太郎",
  grade: "1年",
  pickupDate: "2026-04-10",
  orderItems: [
    {
      menuId: "tamago_don",
      menuName: "玉子丼",
      price: 450,
      quantity: 1,
    },
  ],
  totalPrice: 450,
  notes: "",
  createdAt: "2026-04-08T09:00:00.000Z",
  status: "confirmed",
  paymentStatus: "unpaid",
};

describe("reservation-store", () => {
  beforeEach(async () => {
    // Clear storage before each test
    await saveReservations([]);
  });

  it("should add a reservation", async () => {
    await addReservation(sampleReservation);
    const reservations = await loadReservations();
    expect(reservations).toHaveLength(1);
    expect(reservations[0].id).toBe("test-id-1");
    expect(reservations[0].status).toBe("confirmed");
  });

  it("should cancel only the specified reservation", async () => {
    const reservation2 = { ...sampleReservation, id: "test-id-2" };
    await addReservation(sampleReservation);
    await addReservation(reservation2);

    // Cancel only the first reservation
    await cancelReservation("test-id-1");

    const reservations = await loadReservations();
    expect(reservations).toHaveLength(2);

    const cancelled = reservations.find((r) => r.id === "test-id-1");
    const confirmed = reservations.find((r) => r.id === "test-id-2");

    expect(cancelled?.status).toBe("cancelled");
    expect(confirmed?.status).toBe("confirmed");
  });

  it("should mark only the specified reservation as picked up", async () => {
    const reservation2 = { ...sampleReservation, id: "test-id-2" };
    await addReservation(sampleReservation);
    await addReservation(reservation2);

    // Mark only the first reservation as picked up
    await markReservationPickedUp("test-id-1");

    const reservations = await loadReservations();
    expect(reservations).toHaveLength(2);

    const pickedUp = reservations.find((r) => r.id === "test-id-1");
    const confirmed = reservations.find((r) => r.id === "test-id-2");

    expect(pickedUp?.status).toBe("picked_up");
    expect(confirmed?.status).toBe("confirmed");
  });

  it("getBusinessDayDeadline: 月曜受取 → 木曜17:00", () => {
    // 2026-04-06 (月曜) の前々営業日 = 2026-04-02 (木曜)
    const deadline = getBusinessDayDeadline("2026-04-06");
    expect(deadline.getDay()).toBe(4); // 木曜 = 4
    expect(deadline.getHours()).toBe(17);
  });

  it("getBusinessDayDeadline: 火曜受取 → 金曜17:00", () => {
    // 2026-04-07 (火曜) の前々営業日 = 2026-04-03 (金曜)
    const deadline = getBusinessDayDeadline("2026-04-07");
    expect(deadline.getDay()).toBe(5); // 金曜 = 5
    expect(deadline.getHours()).toBe(17);
  });

  it("getBusinessDayDeadline: 水曜受取 → 月曜17:00", () => {
    // 2026-04-08 (水曜) の前々営業日 = 2026-04-06 (月曜)
    const deadline = getBusinessDayDeadline("2026-04-08");
    expect(deadline.getDay()).toBe(1); // 月曜 = 1
    expect(deadline.getHours()).toBe(17);
  });

  it("getBusinessDayDeadline: 金曜受取 → 水曜17:00", () => {
    // 2026-04-10 (金曜) の前々営業日 = 2026-04-08 (水曜)
    const deadline = getBusinessDayDeadline("2026-04-10");
    expect(deadline.getDay()).toBe(3); // 水曜 = 3
    expect(deadline.getHours()).toBe(17);
  });

  it("getBusinessDayDeadline: GW祝日を跳び越えて正しい期限を計算", () => {
    // 2026-05-07 (木曜) の前々営業日
    // 2026-05-06 (水曜) = 祝日（休日） → スキップ
    // 2026-05-05 (火曜) = 祝日（こどもの日） → スキップ
    // 2026-05-04 (月曜) = 祝日（みどりの日） → スキップ
    // 2026-05-03 (日曜) = 祝日かつ日曜 → スキップ
    // 2026-05-02 (土曜) = 土日 → スキップ
    // 2026-04-30 (木曜) = 営業日 → count=1
    // 2026-04-29 (水曜) = 祝日（昭和の日） → スキップ
    // 2026-04-28 (火曜) = 営業日 → count=2 → 期限日
    const deadline = getBusinessDayDeadline("2026-05-07");
    expect(deadline.getHours()).toBe(17);
    expect(deadline.getDay()).toBe(4); // 木曜 = 2026-04-30 (UTC+0環境)
  });

  it("should not affect other reservations when cancelling", async () => {
    const reservation2 = { ...sampleReservation, id: "test-id-2", status: "picked_up" as const };
    const reservation3 = { ...sampleReservation, id: "test-id-3" };

    await saveReservations([sampleReservation, reservation2, reservation3]);

    // Cancel only the first reservation
    await cancelReservation("test-id-1");

    const reservations = await loadReservations();
    expect(reservations).toHaveLength(3);

    const cancelled = reservations.find((r) => r.id === "test-id-1");
    const pickedUp = reservations.find((r) => r.id === "test-id-2");
    const confirmed = reservations.find((r) => r.id === "test-id-3");

    expect(cancelled?.status).toBe("cancelled");
    expect(pickedUp?.status).toBe("picked_up");
    expect(confirmed?.status).toBe("confirmed");
  });
});
