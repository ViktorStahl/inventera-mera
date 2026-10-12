import type { Observation, SpeciesList, SurveyLocale } from "@/domain/models";
import {
  localeDraftKey,
  localeEditDraftKey,
  normalizeSurveyBackup,
  normalizeSpeciesForList,
  observationDraftKey,
  observationEditDraftKey,
  resolveObservationInput,
  speciesSnapshotMatches,
  surveyEditDraftKey,
  taxonMatchScore,
} from "../repositoryPolicy";

const locale: SurveyLocale = {
  id: "locale-1",
  surveyId: "survey-1",
  name: "Lillåsen",
  observedAt: "2026-08-15T09:00:00+02:00",
  timeZone: "Europe/Stockholm",
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6_400_000, easting: 1_300_000, crs: "EPSG:3847" },
    source: "manual-rt90",
  },
  useLocaleTimeByDefault: false,
  useLocalePositionByDefault: false,
  createdAt: "2026-08-15T07:00:00.000Z",
  updatedAt: "2026-08-15T07:00:00.000Z",
};

function observationInput(): Omit<Observation, "id" | "createdAt" | "updatedAt"> {
  return {
    surveyId: "wrong-survey",
    localeId: "wrong-locale",
    localityName: "Gammalt namn",
    observedAt: "2026-08-15T10:00:00+02:00",
    timeZone: "Europe/Stockholm",
    position: {
      wgs84: { latitude: 58, longitude: 12 },
      rt90: { northing: 6_500_000, easting: 1_400_000, crs: "EPSG:3847" },
      source: "manual-rt90",
    },
    timeOverridden: false,
    positionOverridden: false,
    species: { source: "free-text", enteredName: "Ängsvädd" },
    additionalObservers: [],
  };
}

describe("shared repository policy", () => {
  it("builds stable draft identities for every form level", () => {
    expect(surveyEditDraftKey("survey-1")).toBe("survey:edit:survey-1");
    expect(localeDraftKey("survey-1")).toBe("locale:new:survey-1");
    expect(localeEditDraftKey("survey-1", "locale-1")).toBe("locale:edit:survey-1:locale-1");
    expect(observationDraftKey("survey-1", "locale-1")).toBe("observation:new:survey-1:locale-1");
    expect(observationEditDraftKey("survey-1", "locale-1", "observation-1"))
      .toBe("observation:edit:survey-1:locale-1:observation-1");
  });

  it("resolves inherited values from the current locale", () => {
    expect(resolveObservationInput(observationInput(), locale)).toMatchObject({
      surveyId: "survey-1",
      localeId: "locale-1",
      localityName: "Lillåsen",
      observedAt: locale.observedAt,
      position: locale.position,
    });
  });

  it("preserves explicit time and position overrides", () => {
    const input = { ...observationInput(), timeOverridden: true, positionOverridden: true };
    const resolved = resolveObservationInput(input, locale);
    expect(resolved.observedAt).toBe(input.observedAt);
    expect(resolved.position).toBe(input.position);
  });

  it("preserves locale defaults when normalizing the current backup format", () => {
    const currentLocale = { ...locale, useLocaleTimeByDefault: true };
    const backup = normalizeSurveyBackup({
      format: "inventera-mera-backup",
      formatVersion: 5,
      exportedAt: "2026-10-11T12:00:00.000Z",
      survey: {
        id: "survey-1",
        title: "Inventering",
        surveyDate: "2026-10-11",
        status: "active",
        createdAt: "2026-10-11T12:00:00.000Z",
        updatedAt: "2026-10-11T12:00:00.000Z",
      },
      locales: [currentLocale],
      observations: [],
    });

    expect(backup.formatVersion).toBe(5);
    expect(backup.locales[0]).toMatchObject({
      useLocaleTimeByDefault: true,
      useLocalePositionByDefault: false,
    });
  });

  it("normalizes taxonomy species to the list taxonomy", () => {
    const list: SpeciesList = {
      id: "list-1",
      name: "Fjällväxter",
      taxonomyRef: { packageId: "vascular", name: "Kärlväxter", version: "1" },
      createdAt: "2026-08-15T07:00:00.000Z",
      updatedAt: "2026-08-15T07:00:00.000Z",
    };
    expect(normalizeSpeciesForList(list, {
      source: "taxonomy",
      enteredName: "Ängsvädd",
      taxonId: "taxon-1",
    })).toMatchObject({ taxonomyPackageId: "vascular", taxonomyVersion: "1" });
  });

  it("uses the same accent-insensitive matching and scoring on both platforms", () => {
    const species = { source: "free-text" as const, enteredName: "Ängsvädd" };
    expect(speciesSnapshotMatches(species, ["angsv"])).toBe(true);
    expect(taxonMatchScore({
      id: "taxon-1",
      source: "taxonomy",
      preferredName: "Ängsvädd",
      scientificName: "Succisa pratensis",
      synonyms: [],
      rank: "species",
      status: "accepted",
    }, ["ängsvädd"])).toBe(0);
  });
});
