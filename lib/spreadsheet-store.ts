import AsyncStorage from "@react-native-async-storage/async-storage";

const SPREADSHEET_ID_KEY = "bento_spreadsheet_id";

/**
 * スプレッドシート ID を読み込む
 */
export async function loadSpreadsheetId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SPREADSHEET_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * スプレッドシート ID を保存する
 */
export async function saveSpreadsheetId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SPREADSHEET_ID_KEY, id);
  } catch (error) {
    console.error("Failed to save spreadsheet ID:", error);
  }
}

/**
 * スプレッドシート URL を取得する
 */
export function getSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
