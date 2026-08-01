import type { Observation } from "../models";
import { filterMapObservations, listSpeciesFilterOptions, speciesFilterKey } from "../mapFilters";

function observation(id: string, localeId: string, species: string, date: string): Observation {
  return {
    id,
    surveyId: "survey-1",
    localeId,
    observedAt: `${date}T10:00:00+02:00`,
    timeZone: "Europe/Stockholm",
    localityName: localeId,
    timeOverridden: false,
    positionOverridden: false,
    position: { wgs84: { latitude: 57, longitude: 12 }, rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" }, source: "manual-rt90" },
    species: { source: "free-text", enteredName: species },
    additionalObservers: [],
    createdAt: "2026-07-31T08:00:00.000Z",
    updatedAt: "2026-07-31T08:00:00.000Z",
  };
}

describe("map filters", () => {
  const observations = [
    observation("1", "north", "Ängsvädd", "2026-07-31"),
    observation("2", "south", "Ängsvädd", "2026-08-01"),
    observation("3", "north", "Blodrot", "2026-07-31"),
  ];

  it("combines locale, species and date with AND", () => {
    expect(filterMapObservations(observations, {
      localeIds: ["north"],
      speciesKeys: [speciesFilterKey(observations[0]!)],
      date: "2026-07-31",
    }).map((item) => item.id)).toEqual(["1"]);
  });

  it("builds unique species options with counts", () => {
    expect(listSpeciesFilterOptions(observations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Ängsvädd", count: 2 }),
      expect.objectContaining({ name: "Blodrot", count: 1 }),
    ]));
  });
});
