/**
 * プロフィール画面
 *
 * - 未登録時：初回登録フォームを表示
 * - 登録済み時：現在の情報を表示し、「編集」ボタンで編集モードに切り替え可能
 */

import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  Pressable,
  View,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  loadStudentProfile,
  saveStudentProfile,
  updateStudentProfile,
} from "@/lib/student-profile-store";
import { loadSpreadsheetId, saveSpreadsheetId, getSpreadsheetUrl } from "@/lib/spreadsheet-store";
import { USER_CATEGORIES, type UserCategory, type StudentProfile } from "@/types/student-profile";
import { trpc } from "@/lib/trpc";

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

function getCategoryLabel(category: UserCategory): string {
  return USER_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ─────────────────────────────────────────────
// 情報表示コンポーネント（ビューモード）
// ─────────────────────────────────────────────

interface ProfileViewProps {
  profile: StudentProfile;
  spreadsheetUrl: string | null;
  onEdit: () => void;
  colors: ReturnType<typeof useColors>;
}

function ProfileView({ profile, spreadsheetUrl, onEdit, colors }: ProfileViewProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ヘッダー */}
      <View style={styles.viewHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {profile.name.charAt(0)}
          </Text>
        </View>
        <Text style={[styles.viewName, { color: colors.foreground }]}>
          {profile.name}
        </Text>
        <Text style={[styles.viewCategory, { color: colors.muted }]}>
          {getCategoryLabel(profile.category)}
        </Text>
      </View>

      {/* 情報カード */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow
          label="氏名"
          value={profile.name}
          colors={colors}
        />
          <InfoRow
            label="属性"
            value={getCategoryLabel(profile.category)}
            colors={colors}
          />
        {profile.studentId && (
          <InfoRow
            label="学籍番号"
            value={profile.studentId}
            colors={colors}
          />
        )}
        <InfoRow
          label="電話番号"
          value={profile.phone}
          colors={colors}
        />
        <InfoRow
          label="メールアドレス"
          value={profile.email}
          colors={colors}
          isLast
        />
      </View>

      {/* 登録日 */}
      <Text style={[styles.registeredAt, { color: colors.muted }]}>
        登録日：{formatDate(profile.createdAt)}
      </Text>

      {/* Google Sheets リンク */}
      {spreadsheetUrl && (
        <View style={[styles.sheetsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sheetsLabel, { color: colors.muted }]}>
            Google スプレッドシート
          </Text>
          <Text
            style={[styles.sheetsUrl, { color: colors.primary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {spreadsheetUrl}
          </Text>
        </View>
      )}

      {/* 編集ボタン */}
      <Pressable
        style={[styles.editButton, { backgroundColor: colors.primary }]}
        onPress={onEdit}
      >
        <Text style={styles.editButtonText}>情報を編集する</Text>
      </Pressable>
    </ScrollView>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  isLast?: boolean;
}

function InfoRow({ label, value, colors, isLast }: InfoRowProps) {
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// 編集フォームコンポーネント（編集モード）
// ─────────────────────────────────────────────

interface ProfileFormProps {
  initialProfile: StudentProfile | null;
  onSave: (profile: StudentProfile) => void;
  onCancel?: () => void;
  colors: ReturnType<typeof useColors>;
}

function ProfileForm({ initialProfile, onSave, onCancel, colors }: ProfileFormProps) {
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [category, setCategory] = useState<UserCategory>(
    initialProfile?.category ?? "undergraduate_1"
  );
  const [studentId, setStudentId] = useState(initialProfile?.studentId ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [email, setEmail] = useState(initialProfile?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createSpreadsheetMutation = trpc.sheets.createSpreadsheet.useMutation();
  const writeStudentProfileMutation = trpc.sheets.writeStudentProfile.useMutation();

  const isStudentIdRequired = category !== "staff" && category !== "other";
  const isEditing = initialProfile !== null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "氏名を入力してください";
    if (isStudentIdRequired && !studentId.trim()) {
      newErrors.studentId = "学籍番号を入力してください";
    }
    if (!phone.trim()) newErrors.phone = "電話番号を入力してください";
    if (!email.trim()) newErrors.email = "メールアドレスを入力してください";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "有効なメールアドレスを入力してください";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const profileData = {
        name: name.trim(),
        category,
        studentId: isStudentIdRequired ? studentId.trim() : undefined,
        phone: phone.trim(),
        email: email.trim(),
      };

      let savedProfile: StudentProfile;

      if (isEditing) {
        // 既存プロフィールを更新（id・createdAt を引き継ぐ）
        savedProfile = await updateStudentProfile(profileData);

        // Google Sheets に更新内容を書き込む
        try {
          const spreadsheetId = await loadSpreadsheetId();
          if (spreadsheetId) {
            await writeStudentProfileMutation.mutateAsync({
              spreadsheetId,
              profile: savedProfile,
            });
          }
        } catch (sheetError) {
          console.warn("Failed to update spreadsheet:", sheetError);
        }
      } else {
        // 初回登録
        savedProfile = await saveStudentProfile(profileData);

        // Google Sheets スプレッドシートを作成
        try {
          const sheetTitle = `${savedProfile.name} - 勝山ランチ`;
          const createResult = await createSpreadsheetMutation.mutateAsync({
            title: sheetTitle,
          });
          if (createResult.success && createResult.spreadsheetId) {
            await saveSpreadsheetId(createResult.spreadsheetId);
            await writeStudentProfileMutation.mutateAsync({
              spreadsheetId: createResult.spreadsheetId,
              profile: savedProfile,
            });
          }
        } catch (sheetError) {
          console.warn("Failed to create/write to spreadsheet:", sheetError);
        }
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onSave(savedProfile);
    } catch (error) {
      console.error("Failed to save profile:", error);
      setErrors({
        submit: error instanceof Error ? error.message : "保存に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {isEditing ? "プロフィール編集" : "プロフィール登録"}
          </Text>
          {!isEditing && (
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              初回のみ登録が必要です。以後は自動で使用されます。
            </Text>
          )}
        </View>

        {/* フォーム */}
        <View style={styles.form}>
          {/* 氏名 */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              氏名 <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: errors.name ? colors.error : colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="山田 太郎"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              editable={!loading}
              returnKeyType="next"
            />
            {errors.name && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {errors.name}
              </Text>
            )}
          </View>

          {/* 身分 */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              属性 <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={styles.categoryGrid}>
              {(["undergraduate", "graduate", "staff", "other"] as const).map((type) => {
                const isSelected =
                  type === "undergraduate"
                    ? category.startsWith("undergraduate")
                    : category === type;
                const label =
                  type === "undergraduate"
                    ? "学部生"
                    : type === "graduate"
                    ? "大学院生"
                    : type === "staff"
                    ? "教職員"
                    : "その他";
                const targetCategory: UserCategory =
                  type === "undergraduate" ? "undergraduate_1" : type;
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.categoryButton,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(targetCategory)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        { color: isSelected ? "#ffffff" : colors.foreground },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 学年セレクター（学部生のみ） */}
            {category.startsWith("undergraduate") && (
              <View style={styles.yearGrid}>
                {[1, 2, 3, 4].map((year) => {
                  const yearCategory: UserCategory = `undergraduate_${year}` as UserCategory;
                  return (
                    <Pressable
                      key={yearCategory}
                      style={[
                        styles.yearButton,
                        {
                          backgroundColor:
                            category === yearCategory ? colors.primary : colors.surface,
                          borderColor:
                            category === yearCategory ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setCategory(yearCategory)}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.yearButtonText,
                          {
                            color:
                              category === yearCategory ? "#ffffff" : colors.foreground,
                          },
                        ]}
                      >
                        {year}年
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 学籍番号（学生のみ） */}
          {isStudentIdRequired && (
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                学籍番号 <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errors.studentId ? colors.error : colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="2024001"
                placeholderTextColor={colors.muted}
                value={studentId}
                onChangeText={setStudentId}
                editable={!loading}
                returnKeyType="next"
              />
              {errors.studentId && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.studentId}
                </Text>
              )}
            </View>
          )}

          {/* 電話番号 */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              電話番号 <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: errors.phone ? colors.error : colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="090-1234-5678"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!loading}
              returnKeyType="next"
            />
            {errors.phone && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {errors.phone}
              </Text>
            )}
          </View>

          {/* メールアドレス */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              メールアドレス <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: errors.email ? colors.error : colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="yamada@example.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            {errors.email && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {errors.email}
              </Text>
            )}
          </View>

          {/* 送信エラー */}
          {errors.submit && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {errors.submit}
            </Text>
          )}
        </View>

        {/* ボタン群 */}
        <View style={styles.buttonGroup}>
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditing ? "変更を保存する" : "登録する"}
              </Text>
            )}
          </Pressable>

          {isEditing && onCancel && (
            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.muted }]}>
                キャンセル
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// メイン画面
// ─────────────────────────────────────────────

export default function ProfileSetupScreen() {
  const colors = useColors();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const [p, sheetId] = await Promise.all([
      loadStudentProfile(),
      loadSpreadsheetId(),
    ]);
    setProfile(p);
    if (sheetId) {
      setSpreadsheetUrl(getSpreadsheetUrl(sheetId));
    }
    setInitialLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSave = (savedProfile: StudentProfile) => {
    setProfile(savedProfile);
    setIsEditing(false);
    Alert.alert("保存完了", "プロフィールを更新しました。");
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (initialLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  // 未登録 or 編集モード → フォームを表示
  if (!profile || isEditing) {
    return (
      <ScreenContainer>
        <ProfileForm
          initialProfile={isEditing ? profile : null}
          onSave={handleSave}
          onCancel={isEditing ? handleCancel : undefined}
          colors={colors}
        />
      </ScreenContainer>
    );
  }

  // 登録済み → 情報表示
  return (
    <ScreenContainer>
      <ProfileView
        profile={profile}
        spreadsheetUrl={spreadsheetUrl}
        onEdit={handleEdit}
        colors={colors}
      />
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },

  // ── ビューモード ──
  viewHeader: {
    alignItems: "center",
    marginBottom: 28,
    gap: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
  },
  viewName: {
    fontSize: 22,
    fontWeight: "700",
  },
  viewCategory: {
    fontSize: 14,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: "hidden",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
    minWidth: 88,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "400",
    flex: 1,
    textAlign: "right",
  },
  registeredAt: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  sheetsCard: {
    borderRadius: 10,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 4,
  },
  sheetsLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  sheetsUrl: {
    fontSize: 12,
  },
  editButton: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  // ── フォームモード ──
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "500",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    minWidth: "48%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  yearButton: {
    flex: 1,
    minWidth: "22%",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  yearButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  buttonGroup: {
    gap: 10,
  },
  submitButton: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
