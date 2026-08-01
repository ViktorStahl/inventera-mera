import type { LegacyObservation } from "../migrateLocales";
import { migrateLegacyObservations } from "../migrateLocales";

function legacy(id: string, localityName: string, minute: string, northing = 6400000): LegacyObservation {
  return {
    id,
    surveyId: "survey-1",
    observedAt: `2026-07-31T10:${minute}:00+02:00`,
    timeZone: "Europe/Stockholm",
    localityName,
    position: {
      wgs84: { latitude: 57.7, longitude: 11.9 },
      rt90: { northing, easting: 1300000, crs: "EPSG:3847" },
      source: "manual-rt90",
    },
    species: { source: "free-text", enteredName: `Art ${id}` },
    additionalObservers: [],
    createdAt: `2026-07-31T08:${minute}:00.000Z`,
    updatedAt: `2026-07-31T08:${minute}:00.000Z`,
  };
}

describe("v1 locale migration", () => {
  it("groups exact locality names and preserves later time and position as overrides", () => {
    let next = 0;
    const migrated = migrateLegacyObservations([
      legacy("second", "Lillåsen", "20", 6400020),
      legacy("first", "Lillåsen", "10"),
      legacy("other", "Lillåsen syd", "30"),
    ], () => `locale-${++next}`);

    expect(migrated.locales).toHaveLength(2);
    expect(migrated.locales[0]?.observedAt).toContain("10:10");
    expect(migrated.observations.find((item) => item.id === "first")).toMatchObject({ timeOverridden: false, positionOverridden: false });
    expect(migrated.observations.find((item) => item.id === "second")).toMatchObject({ timeOverridden: true, positionOverridden: true });
  });
});
