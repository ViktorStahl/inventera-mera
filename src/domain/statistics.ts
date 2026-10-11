import { speciesKey } from "./species";
import type { SpeciesSnapshot } from "./models";

export type StatisticsObservation = {
  observedAt: string;
  timeZone: string;
  species: SpeciesSnapshot;
};

export type MonthlyObservationCount = {
  month: string;
  observationCount: number;
};

export type TopSpeciesCount = {
  speciesKey: string;
  name: string;
  observationCount: number;
};

export type StatisticsSummary = {
  surveyCount: number;
  totalObservations: number;
  averageObservationsPerSurvey: number | null;
  observationsByMonth: MonthlyObservationCount[];
  topSpecies: TopSpeciesCount[];
};

type SpeciesCount = {
  name: string;
  observationCount: number;
};

export function getRecentMonthlyCounts(
  months: MonthlyObservationCount[],
  now: Date = new Date(),
): MonthlyObservationCount[] {
  const countsByMonth = new Map<string, number>();
  for (const month of months) {
    countsByMonth.set(month.month, month.observationCount);
  }
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const recentMonths: MonthlyObservationCount[] = [];

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo -= 1) {
    const date = new Date(Date.UTC(currentYear, currentMonth - monthsAgo, 1));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const key = year + "-" + month;
    recentMonths.push({ month: key, observationCount: countsByMonth.get(key) ?? 0 });
  }

  return recentMonths;
}

export function calculateStatisticsSummary(
  surveyCount: number,
  observations: StatisticsObservation[],
): StatisticsSummary {
  const validSurveyCount = Math.max(0, surveyCount);
  const monthlyCounts = new Map<string, number>();
  const speciesCounts = new Map<string, SpeciesCount>();

  for (const observation of observations) {
    const month = monthInRecordedTimeZone(observation.observedAt, observation.timeZone);
    if (month) {
      monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
    }

    const key = speciesKey(observation.species);
    const name = speciesDisplayName(observation.species);
    const existing = speciesCounts.get(key);
    if (existing) {
      existing.observationCount += 1;
      existing.name = preferredDisplayName(existing.name, name);
    } else {
      speciesCounts.set(key, { name, observationCount: 1 });
    }
  }

  return {
    surveyCount: validSurveyCount,
    totalObservations: observations.length,
    averageObservationsPerSurvey:
      validSurveyCount > 0 ? observations.length / validSurveyCount : null,
    observationsByMonth: fillMissingMonths(monthlyCounts),
    topSpecies: [...speciesCounts.entries()]
      .map(([key, count]) => ({
        speciesKey: key,
        name: count.name,
        observationCount: count.observationCount,
      }))
      .sort(
        (left, right) =>
          right.observationCount - left.observationCount ||
          left.name.localeCompare(right.name, "sv") ||
          left.speciesKey.localeCompare(right.speciesKey),
      )
      .slice(0, 3),
  };
}

function monthInRecordedTimeZone(observedAt: string, timeZone: string): string | undefined {
  const date = new Date(observedAt);
  if (!Number.isFinite(date.getTime())) return undefined;

  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    if (year && month) return year + "-" + month.padStart(2, "0");
  } catch {
    // Malformed historical time zones fall back to the timestamp's UTC month.
  }

  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
}

function fillMissingMonths(counts: Map<string, number>): MonthlyObservationCount[] {
  const observedMonths = [...counts.keys()].sort();
  if (observedMonths.length === 0) return [];

  const firstMonth = observedMonths[0];
  const lastMonth = observedMonths[observedMonths.length - 1];
  if (!firstMonth || !lastMonth) return [];

  const result: MonthlyObservationCount[] = [];
  let month = firstMonth;
  while (month <= lastMonth) {
    result.push({ month, observationCount: counts.get(month) ?? 0 });
    month = nextMonth(month);
  }
  return result;
}

function nextMonth(month: string): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (monthNumber === 12) return (year + 1) + "-01";
  return yearText + "-" + String(monthNumber + 1).padStart(2, "0");
}

function speciesDisplayName(species: SpeciesSnapshot): string {
  return species.preferredName?.trim() || species.enteredName.trim() || "Okänd art";
}

function preferredDisplayName(current: string, candidate: string): string {
  const comparison = candidate.localeCompare(current, "sv");
  if (comparison < 0 || (comparison === 0 && candidate < current)) return candidate;
  return current;
}
