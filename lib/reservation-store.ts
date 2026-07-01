import AsyncStorage from "@react-native-async-storage/async-storage";
import { Reservation } from "@/types/reservation";
import { isBusinessDay, parseDateLocal, formatDateISO } from "./japanese-holidays";

const STORAGE_KEY = "bento_reservations";

// スプレッドシート（GAS）のURL
const GAS_URL = "https://bento-app-5tp8.onrender.com/proxy";

/**
 * 予約データを読み込む（スプレッドシートから取得して同期する）
 */
export async function loadReservations(): Promise<Reservation[]> {
  try {
    // 1. スプレッドシート（GAS）から最新データをフェッチ
    const response = await fetch(GAS_URL);
    const result = await response.json();

    if (result.success && result.orders) {
      // 2. GASのデータ形式をアプリの Reservation 形式に変換
      const remoteOrders: Reservation[] = result.orders.map((order: any) => {
        // メニュー文字列 "A×1；B×1" をパース
        const items = order.menu.split('；').filter(Boolean).map((item: string) => {
          const parts = item.split('×');
          return {
            menuName: parts[0] ? parts[0].trim() : "不明なメニュー",
            quantity: parts[1] ? parseInt(parts[1], 10) : 1
          };
        });

        return {
          id: order.id,
          studentName: order.name,
          pickupDate: order.pickupDate,
          totalPrice: order.totalPrice,
          orderItems: items,
          // 状態の文言をアプリ内部の識別子に変換
          paymentStatus: order.paymentStatus === "支払い済み" ? "paid" : "unpaid",
          status: order.receiveStatus === "受け取り済み" ? "picked_up" : (order.receiveStatus === "キャンセル" ? "cancelled" : "confirmed"),
          createdAt: order.pickupDate // ソート用に日付を代入
        };
      });

      // 3. ローカルの保存データも最新に更新しておく
      await saveReservations(remoteOrders);
      return remoteOrders;
    }
  } catch (error) {
    console.error("スプレッドシートからの取得に失敗しました。ローカルデータを使用します:", error);
  }

  // ネットワークエラー時はローカルに保存されているデータを返す
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? (JSON.parse(json) as Reservation[]) : [];
}

/**
 * ローカルストレージに保存（予備・キャッシュ用）
 */
export async function saveReservations(reservations: Reservation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

/**
 * 予約を追加（通常はアプリからの送信時に使用）
 */
export async function addReservation(reservation: Reservation): Promise<void> {
  const existing = await loadReservations();
  await saveReservations([...existing, reservation]);
}

/**
 * キャンセル処理
 */
export async function cancelReservation(id: string): Promise<void> {
  const existing = await loadReservations();
  const updated = existing.map((r) =>
    r.id === id ? { ...r, status: "cancelled" as const } : r
  );
  await saveReservations(updated);
}

/**
 * 受け取り完了処理
 */
export async function markReservationPickedUp(id: string): Promise<void> {
  const existing = await loadReservations();
  const updated = existing.map((r) =>
    r.id === id ? { ...r, status: "picked_up" as const } : r
  );
  await saveReservations(updated);
}

/**
 * 支払い済み処理
 */
export async function markReservationPaid(id: string): Promise<void> {
  const existing = await loadReservations();
  const updated = existing.map((r) =>
    r.id === id ? { ...r, paymentStatus: "paid" as const } : r
  );
  await saveReservations(updated);
}

/**
 * 未払い処理
 */
export async function markReservationUnpaid(id: string): Promise<void> {
  const existing = await loadReservations();
  const updated = existing.map((r) =>
    r.id === id ? { ...r, paymentStatus: "unpaid" as const } : r
  );
  await saveReservations(updated);
}

/**
 * 予約確定（受け取り前に戻す）
 */
export async function markReservationConfirmed(id: string): Promise<void> {
  const existing = await loadReservations();
  const updated = existing.map((r) =>
    r.id === id ? { ...r, status: "confirmed" as const } : r
  );
  await saveReservations(updated);
}

/**
 * IDの生成
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * 日本語形式の日付表示
 */
export function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * キャンセル期限の計算
 */
export function getBusinessDayDeadline(pickupDate: string): Date {
  const d = parseDateLocal(pickupDate);
  let count = 0;
  while (count < 2) {
    d.setDate(d.getDate() - 1);
    const iso = formatDateISO(d);
    if (isBusinessDay(iso)) {
      count++;
    }
  }
  d.setHours(17, 0, 0, 0);
  return d;
}