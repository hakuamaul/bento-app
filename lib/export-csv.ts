import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { Reservation } from "@/types/reservation";

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTimeJP(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function buildCsvContent(reservations: Reservation[]): string {
  const headers = [
    "予約ID",
    "学生名",
    "学年",
    "受け取り日",
    "メニュー（複数の場合は；で区切り）",
    "合計金額",
    "備考",
    "予約日時",
    "ステータス",
  ];

  const rows = reservations.map((r) => {
    const menuList = r.orderItems.map((item) => `${item.menuName}×${item.quantity}`).join("；");
    return [
      escapeCsv(r.id),
      escapeCsv(r.studentName),
      escapeCsv(r.grade),
      escapeCsv(formatDateJP(r.pickupDate)),
      escapeCsv(menuList),
      escapeCsv(r.totalPrice),
      escapeCsv(r.notes),
      escapeCsv(formatDateTimeJP(r.createdAt)),
      escapeCsv(r.status === "confirmed" ? "確定" : "キャンセル"),
    ];
  });

  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  // BOM for Excel UTF-8 compatibility
  return "\uFEFF" + lines.join("\r\n");
}

export async function exportReservationsAsCsv(reservations: Reservation[]): Promise<void> {
  if (Platform.OS === "web") {
    // Web: trigger download via anchor element
    const csv = buildCsvContent(reservations);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const filename = `お弁当予約_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write to file then share
  const csv = buildCsvContent(reservations);
  const now = new Date();
  const filename = `bento_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`;
  const fileUri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("このデバイスでは共有機能が利用できません");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: "お弁当予約データをエクスポート",
    UTI: "public.comma-separated-values-text",
  });
}
