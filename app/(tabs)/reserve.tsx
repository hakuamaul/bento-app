import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  MENU_ITEMS,
  COMPANY_RULES,
  type MenuId,
  type OrderItem,
} from "@/types/reservation";
import { addReservation, generateId } from "@/lib/reservation-store";
import { isBusinessDay, formatDateISO } from "@/lib/japanese-holidays";
import { loadStudentProfile } from "@/lib/student-profile-store";
// SectionLabelなどのコンポーネントが別途定義されている前提です

function getAvailableDates(): string[] {
  const today = formatDateISO(new Date());
  const availableDates: string[] = [];

  for (let i = 1; i <= 60 && availableDates.length < 14; i++) {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(y, m - 1, d + i);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dateStr = `${yy}-${mm}-${dd}`;

    if (!isBusinessDay(dateStr)) continue;

    availableDates.push(dateStr);
  }
  return availableDates;
}

export default function ReserveScreen() {
  const colors = useColors();
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [pickupDate, setPickupDate] = useState("");
  
  const [selectedMenus, setSelectedMenus] = useState<Map<MenuId, number>>(new Map());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dates = getAvailableDates();
    setAvailableDates(dates);
    if (dates.length > 0) {
      setPickupDate(dates[0]);
    }

    const loadProfile = async () => {
      try {
        const profile = await loadStudentProfile();
        setStudentProfile(profile);
      } catch (error) {
        console.error("Failed to load student profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  const calculateTotal = (): number => {
    let total = 0;
    selectedMenus.forEach((qty, menuId) => {
      const item = MENU_ITEMS.find((m) => m.id === menuId);
      if (item) total += item.price * qty;
    });
    return total;
  };

  const handleSubmit = async () => {
    if (!studentProfile) {
      Alert.alert("エラー", "プロフィール登録が必要です。");
      return;
    }
    if (selectedMenus.size === 0) {
      Alert.alert("入力エラー", "メニューを1つ以上選択してください");
      return;
    }

    setSubmitting(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const orderItems: OrderItem[] = Array.from(selectedMenus.entries()).map(([menuId, qty]) => {
      const item = MENU_ITEMS.find((m) => m.id === menuId)!;
      let cleanName = item.name.replace("日替わり弁当（おかずのみ・A）", "おかずA")
                               .replace("日替わり弁当（おかずのみ・B）", "おかずB")
                               .replace("日替わり弁当（おかずのみ・C）", "おかずC");
      return { menuId, menuName: cleanName, price: item.price, quantity: qty };
    });

    const totalPrice = calculateTotal();
    const reservation = {
      id: generateId(),
      studentName: studentProfile.name,
      grade: studentProfile.grade,
      pickupDate,
      orderItems,
      totalPrice,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      status: "confirmed" as const,
      paymentStatus: "unpaid" as const,
    };

    await addReservation(reservation);

    try {
      // 修正済みURL(5fp8)へPOST通信する方式に変更
      const gasUrl = "https://bento-app-5fp8.onrender.com/proxy";

      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reservation),
      });

      if (!response.ok) {
        throw new Error("サーバーからの応答がありませんでした");
      }

      Alert.alert("予約完了！", "予約が確定しました。", [
        { text: "OK", onPress: () => {
            setSelectedMenus(new Map());
            setNotes("");
            router.replace("/");
        }}
      ]);
    } catch (sheetError) {
      console.error("送信エラー:", sheetError);
      Alert.alert("通信エラー", "もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text>読み込み中...</Text>
      </ScreenContainer>
    );
  }

  if (!studentProfile) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
        <Text>プロフィールが未登録です</Text>
        <Pressable onPress={() => router.push("/profile-setup" as never)}>
          <Text>プロフィールを登録する</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text>お弁当を予約する</Text>
          {/* 以降、画面表示用のUIコンポーネントを配置 */}
          <Pressable onPress={handleSubmit}>
            <Text>予約を確定する</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}