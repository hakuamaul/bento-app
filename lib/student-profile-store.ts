import AsyncStorage from "@react-native-async-storage/async-storage";
import { StudentProfile, InsertStudentProfile } from "@/types/student-profile";

const PROFILE_STORAGE_KEY = "bento_student_profile";

/**
 * 学生プロフィールを読み込む
 */
export async function loadStudentProfile(): Promise<StudentProfile | null> {
  try {
    const json = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as StudentProfile;
  } catch {
    return null;
  }
}

/**
 * 学生プロフィールを保存する
 */
export async function saveStudentProfile(profile: InsertStudentProfile): Promise<StudentProfile> {
  const newProfile: StudentProfile = {
    id: generateId(),
    ...profile,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
  return newProfile;
}

/**
 * 学生プロフィールが登録されているか確認
 */
export async function hasStudentProfile(): Promise<boolean> {
  const profile = await loadStudentProfile();
  return profile !== null;
}

/**
 * 学生プロフィールを更新する（idとcreatedAtを引き継ぐ）
 */
export async function updateStudentProfile(updates: InsertStudentProfile): Promise<StudentProfile> {
  const existing = await loadStudentProfile();
  const updated: StudentProfile = {
    id: existing?.id ?? generateId(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...updates,
  };
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * 学生プロフィールを削除（テスト用）
 */
export async function deleteStudentProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
}

/**
 * ID を生成
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
