/**
 * グラフ画面 - 食費まとめ（循環参照バグ対策・完全版）
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import Svg, { Rect, Line, Text as SvgText, G } from "react-native-svg";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
// ★大改造1：エラーの原因になっていた静的インポートを完全に削除してフリーズを防ぐ
import { computeStats, formatYen } from "@/lib/stats";
import type { MonthlyStats, YearlyStats, OverallStats } from "@/lib/stats";
import { useColors } from "@/hooks/use-colors";

// ─────────────────────────────────────────────
// 棒グラフコンポーネント
// ─────────────────────────────────────────────

const CHART_HEIGHT = 180;
const CHART_PADDING_LEFT = 52;
const CHART_PADDING_RIGHT = 8;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 32;
const BAR_GAP = 3;
const MONTH_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12"];

interface BarChartProps {
  months: MonthlyStats[];
  maxAmount: number;
  chartWidth: number;
  primaryColor: string;
  mutedColor: string;
  borderColor: string;
  foregroundColor: string;
  surfaceColor: string;
}

function BarChart({
  months,
  maxAmount,
  chartWidth,
  primaryColor,
  mutedColor,
  borderColor,
  foregroundColor,
  surfaceColor,
}: BarChartProps) {
  const plotWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const barWidth = Math.max(4, (plotWidth - BAR_GAP * 11) / 12 - BAR_GAP);

  const yMax = maxAmount <= 0 ? 1000 : Math.ceil(maxAmount / 1000) * 1000;
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => Math.round(yMax * t));

  return (
    <Svg width={chartWidth} height={CHART_HEIGHT}>
      {yTicks.map((tick) => {
        const y =
          CHART_PADDING_TOP +
          plotHeight -
          (tick / yMax) * plotHeight;
        return (
          <G key={tick}>
            <Line
              x1={CHART_PADDING_LEFT}
              y1={y}
              x2={chartWidth - CHART_PADDING_RIGHT}
              y2={y}
              stroke={borderColor}
              strokeWidth={0.5}
            />
            <SvgText
              x={CHART_PADDING_LEFT - 4}
              y={y + 4}
              fontSize={9}
              fill={mutedColor}
              textAnchor="end"
            >
              {tick === 0 ? "0" : tick >= 1000 ? `${tick / 1000}k` : String(tick)}
            </SvgText>
          </G>
        );
      })}

      {months.map((m, i) => {
        const x =
          CHART_PADDING_LEFT +
          i * ((plotWidth) / 12) +
          BAR_GAP;
        const barH =
          yMax > 0 ? (m.totalAmount / yMax) * plotHeight : 0;
        const y = CHART_PADDING_TOP + plotHeight - barH;

        return (
          <G key={m.yearMonth}>
            <Rect
              x={x}
              y={barH > 0 ? y : CHART_PADDING_TOP + plotHeight - 1}
              width={barWidth}
              height={barH > 0 ? barH : 1}
              fill={m.totalAmount > 0 ? primaryColor : borderColor}
              rx={2}
            />
            <SvgText
              x={x + barWidth / 2}
              y={CHART_PADDING_TOP + plotHeight + 14}
              fontSize={9}
              fill={mutedColor}
              textAnchor="middle"
            >
              {MONTH_LABELS[i]}
            </SvgText>
          </G>
        );
      })}

      <Line
        x1={CHART_PADDING_LEFT}
        y1={CHART_PADDING_TOP + plotHeight}
        x2={chartWidth - CHART_PADDING_RIGHT}
        y2={CHART_PADDING_TOP + plotHeight}
        stroke={borderColor}
        strokeWidth={1}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────
// 月次サマリー行コンポーネント
// ─────────────────────────────────────────────

interface MonthRowProps {
  stats: MonthlyStats;
  colors: ReturnType<typeof useColors>;
}

function MonthRow({ stats, colors }: MonthRowProps) {
  if (stats.totalAmount === 0) {
    return (
      <View style={[styles.monthRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.monthLabel, { color: colors.muted }]}>
          {stats.month}月
        </Text>
        <Text style={[styles.monthAmount, { color: colors.muted }]}>
          —
        </Text>
        <Text style={[styles.monthCount, { color: colors.muted }]}>
          0件
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.monthRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.monthLabel, { color: colors.foreground }]}>
        {stats.month}月
      </Text>
      <View style={styles.monthAmountCol}>
        <Text style={[styles.monthAmount, { color: colors.foreground }]}>
          {formatYen(stats.totalAmount)}
        </Text>
        {stats.unpaidAmount > 0 && (
          <Text style={[styles.unpaidBadge, { color: colors.warning }]}>
            未払い {formatYen(stats.unpaidAmount)}
          </Text>
        )}
      </View>
      <Text style={[styles.monthCount, { color: colors.muted }]}>
        {stats.count}件
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// メイン画面
// ─────────────────────────────────────────────

export default function StatsScreen() {
  const colors = useColors();
  const [monthly, setMonthly] = useState<Map<string, MonthlyStats>>(new Map());
  const [yearly, setYearly] = useState<YearlyStats[]>([]);
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(320);

  const loadData = useCallback(async () => {
    // ★大改造2：Webビルド時のお見合いによる未定義フリーズを完全に回避するため、
    // 画面が立ち上がってデータを読み込むこの瞬間に、動的にファイルを呼び出す
    const { loadReservationsWithDefaults } = await import("@/lib/reservation-store");

    const reservations = await loadReservationsWithDefaults();
    const stats = computeStats(reservations);
    setMonthly(stats.monthly);
    setYearly(stats.yearly);
    setOverall(stats.overall);

    if (stats.overall.years.length > 0) {
      const latestYear = stats.overall.years[stats.overall.years.length - 1];
      setSelectedYear((prev) => {
        if (prev === null || !stats.overall.years.includes(prev)) {
          return latestYear;
        }
        return prev;
      });
    } else {
      setSelectedYear(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedYearStats = useMemo(
    () => yearly.find((y) => y.year === selectedYear) ?? null,
    [yearly, selectedYear]
  );

  const maxAmount = useMemo(() => {
    if (!selectedYearStats) return 0;
    return Math.max(...selectedYearStats.months.map((m) => m.totalAmount), 0);
  }, [selectedYearStats]);

  if (!overall || overall.years.length === 0) {
    return (
      <ScreenContainer className="p-4">
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          食費グラフ
        </Text>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon]}>📊</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            まだデータがありません
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.muted }]}>
            お弁当を予約して受け取ると、{"\n"}食費の記録がここに表示されます。
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            食費グラフ
          </Text>
        </View>

        <View style={[styles.overallCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.overallCardTitle}>全期間累計</Text>
          <Text style={styles.overallCardAmount}>
            {formatYen(overall.totalAmount)}
          </Text>
          <View style={styles.overallCardRow}>
            <View style={styles.overallCardStat}>
              <Text style={styles.overallCardStatLabel}>合計件数</Text>
              <Text style={styles.overallCardStatValue}>
                {overall.totalCount}件
              </Text>
            </View>
            <View style={[styles.overallCardDivider]} />
            <View style={styles.overallCardStat}>
              <Text style={styles.overallCardStatLabel}>月平均</Text>
              <Text style={styles.overallCardStatValue}>
                {formatYen(overall.avgMonthlyAmount)}
              </Text>
            </View>
            <View style={[styles.overallCardDivider]} />
            <View style={styles.overallCardStat}>
              <Text style={styles.overallCardStatLabel}>利用期間</Text>
              <Text style={styles.overallCardStatValue}>
                {overall.usagePeriodLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.yearSelectorContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearSelectorScroll}
          >
            {overall.years.map((year) => {
              const isSelected = year === selectedYear;
              return (
                <TouchableOpacity
                  key={year}
                  onPress={() => setSelectedYear(year)}
                  style={[
                    styles.yearButton,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yearButtonText,
                      {
                        color: isSelected ? "#FFFFFF" : colors.foreground,
                        fontWeight: isSelected ? "700" : "400",
                      },
                    ]}
                  >
                    {year}年
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {selectedYearStats && (
          <View
            style={[
              styles.yearSummaryRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.yearSummaryLabel, { color: colors.muted }]}>
              {selectedYear}年 合計
            </Text>
            <Text style={[styles.yearSummaryAmount, { color: colors.foreground }]}>
              {formatYen(selectedYearStats.totalAmount)}
            </Text>
            <Text style={[styles.yearSummaryCount, { color: colors.muted }]}>
              {selectedYearStats.totalCount}件
            </Text>
          </View>
        )}

        {selectedYearStats && (
          <View
            style={[
              styles.chartCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 24)}
          >
            <Text style={[styles.chartTitle, { color: colors.muted }]}>
              {selectedYear}年 月別食費（円）
            </Text>
            <BarChart
              months={selectedYearStats.months}
              maxAmount={maxAmount}
              chartWidth={chartWidth}
              primaryColor={colors.primary}
              mutedColor={colors.muted}
              borderColor={colors.border}
              foregroundColor={colors.foreground}
              surfaceColor={colors.surface}
            />
          </View>
        )}

        {selectedYearStats && (
          <View
            style={[
              styles.monthListCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {selectedYear}年 月別内訳
            </Text>
            {selectedYearStats.months.map((m) => (
              <MonthRow key={m.yearMonth} stats={m} colors={colors} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  pageTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  overallCard: { margin: 16, borderRadius: 16, padding: 20, gap: 4 },
  overallCardTitle: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "500", letterSpacing: 0.5, textTransform: "uppercase" },
  overallCardAmount: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1, marginTop: 4, marginBottom: 12 },
  overallCardRow: { flexDirection: "row", alignItems: "center" },
  overallCardStat: { flex: 1, alignItems: "center", gap: 2 },
  overallCardDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.25)" },
  overallCardStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  overallCardStatValue: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  yearSelectorContainer: { paddingHorizontal: 16, marginBottom: 12 },
  yearSelectorScroll: { gap: 8, flexDirection: "row" },
  yearButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  yearButtonText: { fontSize: 14 },
  yearSummaryRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, gap: 8 },
  yearSummaryLabel: { fontSize: 13, flex: 1 },
  yearSummaryAmount: { fontSize: 16, fontWeight: "700" },
  yearSummaryCount: { fontSize: 13, minWidth: 36, textAlign: "right" },
  chartCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  chartTitle: { fontSize: 12, marginBottom: 8, fontWeight: "500" },
  monthListCard: { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 15, fontWeight: "600", paddingHorizontal: 16, paddingVertical: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, gap: 8 },
  monthLabel: { fontSize: 14, fontWeight: "500", width: 28 },
  monthAmountCol: { flex: 1, gap: 2 },
  monthAmount: { fontSize: 14, fontWeight: "600" },
  unpaidBadge: { fontSize: 11, fontWeight: "500" },
  monthCount: { fontSize: 13, minWidth: 36, textAlign: "right" },
});