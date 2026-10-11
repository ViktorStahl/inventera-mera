import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getRecentMonthlyCounts } from "@/domain/statistics";
import type { MonthlyObservationCount, StatisticsSummary } from "@/domain/statistics";
import { getStatisticsSummary } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { messageOf } from "@/ui/errors";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

const countFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const averageFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

export default function StatisticsScreen() {
  const [summary, setSummary] = useState<StatisticsSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setSummary(await getStatisticsSummary());
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const recentMonths = getRecentMonthlyCounts(summary?.observationsByMonth ?? []);
  const maximumMonthlyCount = maxMonthlyCount(recentMonths);
  const hasRecentObservations = recentMonths.some((month) => month.observationCount > 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Statistik" }} />
      <View style={styles.intro}>
        <Text style={styles.title}>Statistik</Text>
        <Text style={styles.subtitle}>Sammanställning av aktiva och arkiverade inventeringar</Text>
      </View>

      {error ? (
        <Card>
          <Text style={styles.errorTitle}>Statistiken kunde inte läsas</Text>
          <Text style={styles.body}>{error}</Text>
          <Button label="Försök igen" variant="secondary" onPress={() => void load()} />
        </Card>
      ) : null}

      {loading && !summary ? (
        <ActivityIndicator accessibilityLabel="Läser statistik" color={colors.green700} size="large" />
      ) : null}

      {summary ? (
        <>
          <Card>
            <Text style={styles.kpiLabel}>Totalt antal observationer</Text>
            <Text style={styles.kpiValue}>{countFormatter.format(summary.totalObservations)}</Text>
          </Card>

          <Card>
            <Text style={styles.kpiLabel}>Genomsnittliga observationer per inventering</Text>
            <Text style={styles.kpiValue}>
              {summary.averageObservationsPerSurvey === null
                ? "—"
                : averageFormatter.format(summary.averageObservationsPerSurvey)}
            </Text>
            <Text style={styles.caption}>
              Baserat på {countFormatter.format(summary.surveyCount)} aktiva och arkiverade inventeringar
            </Text>
          </Card>

          <Card>
            <View style={styles.chartHeading}>
              <Text style={styles.sectionTitle}>Observationer per månad</Text>
              <Text style={styles.caption}>Senaste 12 månaderna</Text>
            </View>
            {!hasRecentObservations ? (
              <Text style={styles.emptyText}>Inga observationer de senaste 12 månaderna.</Text>
            ) : null}
            <MonthlyBarChart months={recentMonths} maximum={maximumMonthlyCount} />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Topp 3 arter</Text>
            {summary.topSpecies.length === 0 ? (
              <Text style={styles.emptyText}>Arter visas när observationer har registrerats.</Text>
            ) : (
              summary.topSpecies.map((species, index) => (
                <View
                  key={species.speciesKey}
                  accessible
                  accessibilityLabel={
                    (index + 1) + ". " + species.name + ": " +
                    countFormatter.format(species.observationCount) + " observationer"
                  }
                  style={styles.speciesRow}
                >
                  <Text style={styles.speciesRank}>{index + 1}</Text>
                  <Text style={styles.speciesName}>{species.name}</Text>
                  <Text style={styles.speciesCount}>{countFormatter.format(species.observationCount)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      {!loading && !error && summary?.surveyCount === 0 ? (
        <EmptyState title="Ingen statistik ännu" body="Skapa en inventering för att börja samla observationer." />
      ) : null}
    </Screen>
  );
}

function MonthlyBarChart({
  months,
  maximum,
}: {
  months: MonthlyObservationCount[];
  maximum: number;
}) {
  return (
    <View style={styles.monthChart}>
      <View style={styles.chartColumns}>
        {months.map((month) => {
          const count = month.observationCount;
          const barHeight =
            maximum === 0 || count === 0 ? 0 : Math.max(3, (count / maximum) * 92);

          return (
            <View
              key={month.month}
              accessible
              accessibilityRole="image"
              accessibilityLabel={
                formatMonth(month.month) + ": " + countFormatter.format(count) + " observationer"
              }
              style={styles.chartColumn}
            >
              <View style={styles.monthBarStack}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.monthBarCount}
                >
                  {count > 0 ? countFormatter.format(count) : ""}
                </Text>
                <View style={[styles.monthBar, { height: barHeight }]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.chartMonthLabels}>
        {months.map((month) => (
          <Text key={month.month} numberOfLines={1} style={styles.chartMonthLabel}>
            {formatMonthTick(month.month)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function formatMonthTick(month: string): string {
  const date = new Date(month + "-01T00:00:00.000Z");
  return new Intl.DateTimeFormat("sv-SE", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(/\.$/, "");
}

function formatMonth(month: string): string {
  const date = new Date(month + "-01T00:00:00.000Z");
  return new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function maxMonthlyCount(months: MonthlyObservationCount[]): number {
  let maximum = 0;
  for (const month of months) {
    if (month.observationCount > maximum) maximum = month.observationCount;
  }
  return maximum;
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textMuted, lineHeight: 20 },
  kpiLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  kpiValue: { color: colors.green800, fontSize: 32, fontWeight: "700" },
  caption: { color: colors.textMuted, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  emptyText: { color: colors.textMuted, paddingVertical: spacing.sm },
  chartHeading: { gap: spacing.xs },
  monthChart: { gap: spacing.xs },
  chartColumns: {
    flexDirection: "row",
    height: 116,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chartColumn: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "flex-end" },
  monthBarStack: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  monthBarCount: {
    width: "100%",
    height: 16,
    color: colors.textMuted,
    fontSize: 9,
    textAlign: "center",
  },
  monthBar: {
    width: "60%",
    maxWidth: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.green700,
  },
  chartMonthLabels: { flexDirection: "row" },
  chartMonthLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
  },
  speciesRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  speciesRank: { color: colors.green800, fontWeight: "700", width: 24 },
  speciesName: { color: colors.text, flex: 1 },
  speciesCount: { color: colors.text, fontWeight: "700", minWidth: 32, textAlign: "right" },
  errorTitle: { color: colors.danger, fontWeight: "700" },
  body: { color: colors.text, lineHeight: 20 },
});
