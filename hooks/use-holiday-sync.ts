/**
 * use-holiday-sync.ts（WebCORSエラー対策・完全版）
 */

import { useEffect } from "react";
import { Platform } from "react-native"; // ★ウェブ環境を判定するために追加
import { syncHolidays, loadCachedHolidays } from "@/lib/holiday-fetcher";
import { setHolidayDates } from "@/lib/japanese-holidays";

export function useHolidaySync(): void {
  useEffect(() => {
    // ★大改造：Web版（Netlify）の場合は、内閣府への裏通信を一切行わず、
    // japanese-holidays.ts 側の手元データ判定にすべてを任せて即座に終了する
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    async function initialize() {
      // Step 1: キャッシュを即座に読み込んで注入
      const cached = await loadCachedHolidays();
      if (cached && !cancelled) {
        setHolidayDates(cached, "cache");
      }

      // Step 2: 期限切れチェック＋バックグラウンド更新
      const result = await syncHolidays();
      if (cancelled) return;

      if (result.dates && result.dates.length > 0) {
        setHolidayDates(result.dates, result.source);
        if (__DEV__) {
          console.log(
            `[holiday-sync] 祝日データ更新完了: ${result.dates.length}件 (source: ${result.source})`
          );
        }
      } else {
        if (__DEV__) {
          console.log("[holiday-sync] フォールバックデータを使用します");
        }
      }
    }

    initialize().catch((err) => {
      if (__DEV__) {
        console.warn("[holiday-sync] 初期化エラー:", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);
}