/**
 * holiday-fetcher.ts
 *
 * 内閣府「国民の祝日について」CSVを取得し、AsyncStorage にキャッシュする。
 * https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
 *
 * キャッシュ戦略：
 *   - 最後の取得から 7 日以上経過した場合のみ再取得（週1回更新）
 *   - 取得失敗時はキャッシュを継続使用
 *   - キャッシュもない場合はフォールバックデータを使用
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const STORAGE_KEY_DATES = "holiday_dates_v1";
const STORAGE_KEY_FETCHED_AT = "holiday_fetched_at_v1";

/** キャッシュ有効期間（7日間）*/
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shift-JIS の CSV テキストを YYYY-MM-DD 形式の日付文字列セットに変換する。
 * React Native の fetch は UTF-8 テキストとして受け取るため、
 * サーバー側で文字化けが起きる場合は TextDecoder でデコードする。
 *
 * CSV の形式（内閣府）：
 *   国民の祝日・休日月日,国民の祝日・休日名称
 *   1955/1/1,元日
 *   ...
 */
function parseHolidayCsv(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const dates: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("国民の祝日")) continue;
    const parts = trimmed.split(",");
    if (parts.length < 1) continue;
    const raw = parts[0].trim(); // "1955/1/1" 形式
    // YYYY/M/D → YYYY-MM-DD に変換
    const match = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) continue;
    const [, y, m, d] = match;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    dates.push(iso);
  }
  return dates;
}

/**
 * 内閣府 CSV から祝日一覧を取得する。
 * Shift-JIS エンコードのため、まず Shift-JIS デコードを試み、
 * 失敗した場合は UTF-8 としてテキスト取得する。
 * （ウェブ環境では shift-jis エンコードがサポートされない場合がある）
 */
async function fetchHolidaysFromCsv(): Promise<string[]> {
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  let text: string;
  try {
    // まず Shift-JIS デコードを試みる
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("shift-jis");
    text = decoder.decode(buffer);
  } catch {
    // Shift-JIS がサポートされない環境（一部のウェブブラウザ・ウェブビュー）では
    // 再度フェッチして UTF-8 で取得する
    const response2 = await fetch(CSV_URL);
    text = await response2.text();
  }

  return parseHolidayCsv(text);
}

/**
 * キャッシュから祝日日付リストを読み込む。
 * キャッシュがない場合は null を返す。
 */
export async function loadCachedHolidays(): Promise<string[] | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_DATES);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

/**
 * キャッシュが有効期限内かどうかを確認する。
 * 有効期限内なら true を返す。
 */
export async function isCacheValid(): Promise<boolean> {
  try {
    const fetchedAt = await AsyncStorage.getItem(STORAGE_KEY_FETCHED_AT);
    if (!fetchedAt) return false;
    const elapsed = Date.now() - Number(fetchedAt);
    return elapsed < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * 祝日データをキャッシュに保存する。
 */
async function saveCachedHolidays(dates: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_DATES, JSON.stringify(dates));
  await AsyncStorage.setItem(STORAGE_KEY_FETCHED_AT, String(Date.now()));
}

/**
 * 祝日データを同期する。
 *
 * - キャッシュが有効期限内 → スキップ
 * - キャッシュ期限切れ → 内閣府 CSV を取得してキャッシュ更新
 * - 取得失敗 → キャッシュを継続使用（更新タイムスタンプは変更しない）
 *
 * @returns 取得した祝日日付リスト（YYYY-MM-DD 形式）または null（変更なし）
 */
export async function syncHolidays(): Promise<{
  dates: string[] | null;
  source: "network" | "cache" | "fallback";
}> {
  // キャッシュが有効期限内なら何もしない
  const valid = await isCacheValid();
  if (valid) {
    const cached = await loadCachedHolidays();
    return { dates: cached, source: "cache" };
  }

  // ネットワーク取得を試みる
  try {
    const dates = await fetchHolidaysFromCsv();
    if (dates.length > 0) {
      await saveCachedHolidays(dates);
      return { dates, source: "network" };
    }
    throw new Error("Empty holiday list from CSV");
  } catch (error) {
    console.warn("[holiday-fetcher] CSV取得失敗、キャッシュを使用します:", error);
    const cached = await loadCachedHolidays();
    return { dates: cached, source: cached ? "cache" : "fallback" };
  }
}
