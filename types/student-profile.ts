/**
 * 学生の基本情報
 * 初回のみ登録され、以後は自動使用される
 */

export type UserCategory = "undergraduate_1" | "undergraduate_2" | "undergraduate_3" | "undergraduate_4" | "graduate" | "staff" | "other";

export const USER_CATEGORIES: { value: UserCategory; label: string }[] = [
  { value: "undergraduate_1", label: "学部生 1年" },
  { value: "undergraduate_2", label: "学部生 2年" },
  { value: "undergraduate_3", label: "学部生 3年" },
  { value: "undergraduate_4", label: "学部生 4年" },
  { value: "graduate", label: "大学院生" },
  { value: "staff", label: "教職員" },
  { value: "other", label: "その他" },
];

export interface StudentProfile {
  id: string; // UUID
  name: string; // 氏名
  category: UserCategory; // 身分
  studentId?: string; // 学籍番号（教職員・その他はオプション）
  phone: string; // 電話番号
  email: string; // メールアドレス
  createdAt: string; // ISO 8601 形式
}

export type InsertStudentProfile = Omit<StudentProfile, "id" | "createdAt">;
