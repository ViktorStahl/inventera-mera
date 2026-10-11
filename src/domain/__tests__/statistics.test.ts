import { speciesKey } from "@/domain/species";
import type { StatisticsObservation } from "../statistics";
import { calculateStatisticsSummary, getRecentMonthlyCounts } from "../statistics";
describe("getRecentMonthlyCounts", () => {
  it("returns the current month and previous 11, filling gaps and excluding other months", () => {
    const months = getRecentMonthlyCounts(
      [
        { month: "2025-03", observationCount: 99 },
        { month: "2025-04", observationCount: 2 },
        { month: "2025-12", observationCount: 4 },
        { month: "2026-03", observationCount: 6 },
        { month: "2026-04", observationCount: 99 },
      ],
      new Date(2026, 2, 15, 12),
    );

    expect(months.map((month) => month.month)).toEqual([
      "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09",
      "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
    ]);
    expect(months.map((month) => month.observationCount)).toEqual([
      2, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 6,
    ]);
  });
});


function observation(
  observedAt: string,
  timeZone: string,
  species: StatisticsObservation["species"],
): StatisticsObservation {
  return { observedAt, timeZone, species };
}

describe("calculateStatisticsSummary", () => {
  it("returns an empty summary without inventing an average when there are no surveys", () => {
    expect(calculateStatisticsSummary(0, [])).toEqual({
      surveyCount: 0,
      totalObservations: 0,
      averageObservationsPerSurvey: null,
      observationsByMonth: [],
      topSpecies: [],
    });
  });

  it("uses the effective observation date in its recorded time zone and fills month gaps", () => {
    const result = calculateStatisticsSummary(4, [
      observation("2026-01-31T23:30:00-05:00", "America/New_York", {
        source: "free-text",
        enteredName: "Alm",
      }),
      observation("2026-03-01T00:30:00+01:00", "Europe/Stockholm", {
        source: "free-text",
        enteredName: "Blåbär",
      }),
    ]);

    expect(result).toMatchObject({
      surveyCount: 4,
      totalObservations: 2,
      averageObservationsPerSurvey: 0.5,
      observationsByMonth: [
        { month: "2026-01", observationCount: 1 },
        { month: "2026-02", observationCount: 0 },
        { month: "2026-03", observationCount: 1 },
      ],
    });
  });

  it("counts observations by stable species identity and ranks ties deterministically", () => {
    const alm = {
      source: "taxonomy" as const,
      enteredName: "Alm",
      preferredName: "Alm",
      taxonId: "taxon-alm",
      taxonomyPackageId: "test-taxonomy",
    };
    const observations = [
      observation("2026-01-01T12:00:00Z", "UTC", alm),
      observation("2026-01-02T12:00:00Z", "UTC", { ...alm, enteredName: "Ulmus glabra" }),
      observation("2026-01-03T12:00:00Z", "UTC", {
        source: "free-text",
        enteredName: "Ängsvädd",
      }),
      observation("2026-01-04T12:00:00Z", "UTC", {
        source: "free-text",
        enteredName: "angsvadd",
      }),
      observation("2026-01-05T12:00:00Z", "UTC", {
        source: "taxonomy",
        enteredName: "Blåbär",
        preferredName: "Blåbär",
        taxonId: "taxon-blabar",
        taxonomyPackageId: "test-taxonomy",
      }),
      observation("2026-01-06T12:00:00Z", "UTC", {
        source: "taxonomy",
        enteredName: "Daggkåpa",
        preferredName: "Daggkåpa",
        taxonId: "taxon-daggkapa",
        taxonomyPackageId: "test-taxonomy",
      }),
    ];

    const summary = calculateStatisticsSummary(2, observations);
    const reversedSummary = calculateStatisticsSummary(2, [...observations].reverse());

    expect(summary.topSpecies).toHaveLength(3);
    expect(summary.topSpecies[0]).toMatchObject({ name: "Alm", observationCount: 2 });
    expect(summary.topSpecies[1]?.observationCount).toBe(2);
    expect(summary.topSpecies[2]?.observationCount).toBe(1);
    expect(summary.topSpecies).toEqual(reversedSummary.topSpecies);
    expect(summary.topSpecies.map((species) => species.speciesKey)).toContain(
      speciesKey({ source: "free-text", enteredName: "Ängsvädd" }),
    );
  });
});
