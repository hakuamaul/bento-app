import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  cancelReservation,
  formatDateJP,
  loadReservations,
  getBusinessDayDeadline,
  markReservationConfirmed,
  markReservationPaid,
  markReservationUnpaid,
} from "@/lib/reservation-store";
import { exportReservationsAsCsv } from "@/lib/export-csv";
import { type Reservation } from "@/types/reservation";

type FilterType = "all" | "confirmed" | "picked_up";

function getCancelDeadline(pickupDate: string): Date {
  return getBusinessDayDeadline(pickupDate);
}

function formatDeadlineLabel(deadline: Date): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const m = deadline.getMonth() + 1;
  const d = deadline.getDate();
  const day = days[deadline.getDay()];
  return `${m}月${d}日(${day}) 17:00 まで`;
}

function isCancelable(pickupDate: string): boolean {
  if (!pickupDate) return false;
  const deadline = getCancelDeadline(pickupDate);
  return new Date() < deadline;
}

export default function ReservationsScreen() {
  const colors = useColors();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<FilterType>("confirmed");
  const [exporting, setExporting] = useState(false);

  const fetchReservations = useCallback(async () => {
    const data = await loadReservations();
    
    // ★登録されている自分のプロフィール（名前）を読み込む
    const { loadStudentProfile } = await import("@/lib/student-profile-store");
    const profile = await loadStudentProfile();
    
    // ★大改造：自分の予約データ（名前が黒須球子さんと一致するもの）だけを表示するようにフィルターをかけます
    const myData = data.filter((r) => !profile || r.studentName === profile.name);
    
    setReservations(myData.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  useFocusEffect(
    useCallback(() => {
      fetchReservations();
    }, [fetchReservations])
  );

  const filtered = reservations.filter((r) => {
    if (filter === "all") return r.status !== "cancelled";
    return r.status === filter;
  });

  const handleUndoPickup = (id: string) => {
    Alert.alert(
      "「受け取り前」に戻しますか？",
      "受け取り済みの記録を取り消します。よろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "受け取り前に戻す",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            await markReservationConfirmed(id);
            await fetchReservations();
          },
        },
      ]
    );
  };

  const handleMarkPaid = (id: string) => {
    Alert.alert(
      "「支払い済み」にしますか？",
      "このボタンは、代金を支払った後に押してください",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "支払い済みにする",
          style: "default",
          onPress: async () => {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            await markReservationPaid(id);
            await fetchReservations();
          },
        },
      ]
    );
  };

  const handleMarkUnpaid = (id: string) => {
    Alert.alert(
      "「未払い」に戻しますか？",
      "支払い済みの記録を取り消します。よろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "未払いに戻す",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            await markReservationUnpaid(id);
            await fetchReservations();
          },
        },
      ]
    );
  };

  const handleCancel = (id: string, name: string) => {
    Alert.alert(
      "予約をキャンセル",
      `${name}の予約をキャンセルしますか？`,
      [
        { text: "戻る", style: "cancel" },
        {
          text: "キャンセルする",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            await cancelReservation(id);
            await fetchReservations();
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    const confirmed = reservations.filter((r) => r.status === "confirmed");
    if (confirmed.length === 0) {
      Alert.alert("エクスポートできません", "確定済みの予約がありません");
      return;
    }

    setExporting(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await exportReservationsAsCsv(confirmed);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "エクスポートに失敗しました";
      Alert.alert("エラー", msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.pageTitle, { color: colors.foreground }]}>予約一覧</Text>
              </View>
              <Pressable
                onPress={handleExport}
                disabled={exporting}
                style={({ pressed }) => [
                  styles.exportButton,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.8 },
                  exporting && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.exportButtonText}>
                  {exporting ? "エクスポート中..." : "CSV出力"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.filterRow}>
              {(["confirmed", "picked_up", "all"] as FilterType[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={({ pressed }) => [
                    styles.filterTab,
                    filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: filter === f ? colors.primary : colors.muted },
                    ]}
                  >
                    {f === "confirmed" ? "予約済み" : f === "picked_up" ? "受け取り済み" : "すべて"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isPaid = (item.paymentStatus ?? "unpaid") === "paid";
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.cardName, { color: colors.foreground }]}>{item.studentName}</Text>
                  <Text style={[styles.cardDate, { color: colors.muted }]}>
                    {formatDateJP(item.pickupDate)}
                  </Text>
                </View>
                <Text style={[styles.cardPrice, { color: colors.primary }]}>¥{item.totalPrice}</Text>
              </View>

              <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

              <View style={styles.cardItems}>
                {item.orderItems && item.orderItems.map((oi, idx) => (
                  <Text key={idx} style={[styles.cardItem, { color: colors.foreground }]}>
                    • {oi.menuName} × {oi.quantity}
                  </Text>
                ))}
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => isPaid ? handleMarkUnpaid(item.id) : handleMarkPaid(item.id)}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    isPaid
                      ? { backgroundColor: colors.success + "22", borderColor: colors.success }
                      : { backgroundColor: colors.warning + "22", borderColor: colors.warning },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.statusBtnText, { color: isPaid ? colors.success : colors.warning }]}>
                    {isPaid ? "支払い済み" : "未払い"}
                  </Text>
                </Pressable>

                {item.status === "picked_up" && (
                  <Pressable
                    onPress={() => handleUndoPickup(item.id)}
                    style={({ pressed }) => [
                      styles.statusBtn,
                      { backgroundColor: colors.muted + "22", borderColor: colors.muted },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.statusBtnText, { color: colors.muted }]}>受け取り前に戻す</Text>
                  </Pressable>
                )}
              </View>

              {item.status === "confirmed" && (
                <View style={styles.cancelSection}>
                  <Text style={[styles.deadlineText, { color: isCancelable(item.pickupDate) ? colors.muted : colors.error }]}>
                    キャンセル期限：{formatDeadlineLabel(getCancelDeadline(item.pickupDate))}
                  </Text>
                  {isCancelable(item.pickupDate) ? (
                    <Pressable
                      onPress={() => handleCancel(item.id, item.studentName)}
                      style={({ pressed }) => [
                        styles.cancelButton,
                        { backgroundColor: colors.error },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={styles.cancelButtonText}>キャンセル</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.cancelButton, { backgroundColor: colors.border }]}>
                      <Text style={[styles.cancelButtonText, { color: colors.muted }]}>キャンセル不可</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {filter === "confirmed"
                ? "予約済みの予約はありません"
                : filter === "picked_up"
                ? "受け取り済みの予約はありません"
                : "予約はありません"}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingVertical: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  exportButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  exportButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  filterRow: { flexDirection: "row", marginBottom: 16, gap: 16 },
  filterTab: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "transparent" },
  filterTabText: { fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  cardDate: { fontSize: 12 },
  cardPrice: { fontSize: 18, fontWeight: "700" },
  cardDivider: { height: 1, marginVertical: 8 },
  cardItems: { marginBottom: 8 },
  cardItem: { fontSize: 13, lineHeight: 18 },
  cancelSection: { marginTop: 8, gap: 6 },
  deadlineText: { fontSize: 11, lineHeight: 16 },
  cancelButton: { paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  cancelButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 4, flexWrap: "wrap" },
  statusBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusBtnText: { fontSize: 12, fontWeight: "600" },
});