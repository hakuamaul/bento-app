import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { loadReservations, formatDateJP } from "@/lib/reservation-store";
import { type Reservation } from "@/types/reservation";

function getTodayJP(): string {
  const d = new Date();
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
}

export default function HomeScreen() {
  const colors = useColors();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // 初回登録チェック
  useFocusEffect(
    useCallback(() => {
      checkProfile();
    }, [])
  );

  const checkProfile = async () => {
    const { hasStudentProfile } = await import("@/lib/student-profile-store");
    const hasProfile = await hasStudentProfile();
    if (!hasProfile) {
      router.replace("/profile-setup" as never);
      return;
    }
  };

  const fetchReservations = useCallback(async () => {
    const data = await loadReservations();
    
    // 登録されている自分のプロフィール（名前）を読み込む
    const { loadStudentProfile } = await import("@/lib/student-profile-store");
    const profile = await loadStudentProfile();
    
    // ★新設：システムから「現在の年・月（例：2026-06）」を自動で取得する
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    // ★大改造：自分の予約、かつ「受取日が現在の月（当月）で始まるデータだけ」に厳しくフィルターをかける
    const upcoming = data
      .filter((r) => 
        r.status === "confirmed" && 
        (!profile || r.studentName === profile.name) &&
        r.pickupDate && r.pickupDate.startsWith(currentYearMonth) // ★ここで4月などの古いデータを完全に弾きます
      )
      .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate))
      .slice(0, 5);
    setReservations(upcoming);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchReservations();
    }, [fetchReservations])
  );

  useEffect(() => {
    const interval = setInterval(fetchReservations, 2000);
    return () => clearInterval(interval);
  }, [fetchReservations]);

  const handleReserve = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/reserve" as never);
  };

  const confirmedCount = reservations.filter((r) => r.status === "confirmed").length;

  return (
    <ScreenContainer>
      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Date & Greeting */}
            <View style={styles.dateRow}>
              <Text style={[styles.dateText, { color: colors.muted }]}>{getTodayJP()}</Text>
            </View>
            <Text style={[styles.greeting, { color: colors.foreground }]}>
              勝山キャンパス ランチ注文🍙
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              しっかり食べて、しっかり学ぼう
            </Text>

            {/* Reserve Button */}
            <Pressable
              onPress={handleReserve}
              style={({ pressed }) => [
                styles.reserveButton,
                { backgroundColor: colors.primary },
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              ]}
            >
              <IconSymbol name="calendar.badge.plus" size={22} color="#fff" />
              <Text style={styles.reserveButtonText}>お弁当を予約する</Text>
            </Pressable>

            {/* Stats Card */}
            <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{confirmedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>予約中</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <IconSymbol name="fork.knife" size={24} color={colors.warning} />
                <Text style={[styles.statLabel, { color: colors.muted }]}>メニュー多数</Text>
              </View>
            </View>

            {/* Section Title */}
            {reservations.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                直近の予約
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ReservationCard item={item} colors={colors} onRefresh={fetchReservations} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🍱</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                今月の予約はありません
              </Text>
              <Text style={[styles.emptySubText, { color: colors.muted }]}>
                上のボタンから予約してみましょう！
              </Text>
            </View>
          ) : null
        }
      />
    </ScreenContainer>
  );
}

function ReservationCard({
  item,
  colors,
  onRefresh,
}: {
  item: Reservation;
  colors: ReturnType<typeof useColors>;
  onRefresh?: () => void;
}) {
  const menuSummary =
    item.orderItems && item.orderItems.length > 0
      ? item.orderItems.map((o) => `${o.menuName}×${o.quantity}`).join("、")
      : "メニュー情報なし";

  const isPaid = (item.paymentStatus ?? "unpaid") === "paid";

  const handlePickup = () => {
    Alert.alert(
      "「受け取り済み」にしますか？",
      "このボタンは、お弁当を受け取った時に押してください",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "受け取り済みにする",
          style: "default",
          onPress: async () => {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            const { markReservationPickedUp } = await import("@/lib/reservation-store");
            await markReservationPickedUp(item.id);
            if (onRefresh) onRefresh();
          },
        },
      ]
    );
  };

  const handleUndoPickup = () => {
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
            const { markReservationConfirmed } = await import("@/lib/reservation-store");
            await markReservationConfirmed(item.id);
            if (onRefresh) onRefresh();
          },
        },
      ]
    );
  };

  const handlePayment = () => {
    if (isPaid) {
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
              const { markReservationUnpaid } = await import("@/lib/reservation-store");
              await markReservationUnpaid(item.id);
              if (onRefresh) onRefresh();
            },
          },
        ]
      );
    } else {
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
              const { markReservationPaid } = await import("@/lib/reservation-store");
              await markReservationPaid(item.id);
              if (onRefresh) onRefresh();
            },
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardEmoji}>🍱</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.studentName}</Text>
        <Text style={[styles.cardSub, { color: colors.muted }]}>
          {formatDateJP(item.pickupDate)}
        </Text>
        <Text style={[styles.cardSub, { color: colors.muted }]}>
          {menuSummary}
        </Text>
        <Text style={[styles.cardPrice, { color: colors.primary, fontWeight: "700" }]}>
          ¥{item.totalPrice}
        </Text>
      </View>
      <View style={[styles.cardRight, { gap: 8 }]}>
        <Pressable
          onPress={handlePayment}
          style={({ pressed }) => [
            styles.actionBtn,
            isPaid
              ? { backgroundColor: colors.success + "22", borderColor: colors.success }
              : { backgroundColor: colors.warning + "22", borderColor: colors.warning },
            pressed && !isPaid && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: isPaid ? colors.success : colors.warning }]}>
            {isPaid ? "支払い済み" : "未払い"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handlePickup}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.primary + "22", borderColor: colors.primary },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>受け取り前</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 8 },
  dateRow: { marginBottom: 4 },
  dateText: { fontSize: 13, fontWeight: "500" },
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  reserveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
  },
  reserveButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  statsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 4, flex: 1 },
  statDivider: { width: 1, height: 36 },
  statNumber: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  cardLeft: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F1F8E9", alignItems: "center", justifyContent: "center" },
  cardEmoji: { fontSize: 24 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 12, lineHeight: 18 },
  cardPrice: { fontSize: 13, marginTop: 2 },
  cardRight: { alignItems: "center", justifyContent: "center" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, borderWidth: 1, minWidth: 72 },
  actionBtnText: { fontSize: 11, fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubText: { fontSize: 13, textAlign: "center" },
});