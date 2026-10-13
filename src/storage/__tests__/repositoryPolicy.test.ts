import type { SpeciesList, SurveyLocale } from "@/domain/models";
import {
  localeDraftKey,
  localeEditDraftKey,
  parseSurveyBackup,
  normalizeSpeciesForList,
  observationDraftKey,
  observationEditDraftKey,
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

describe("shared repository policy", () => {
  it("builds stable draft identities for every form level", () => {
    expect(surveyEditDraftKey("survey-1")).toBe("survey:edit:survey-1");
    expect(localeDraftKey("survey-1")).toBe("locale:new:survey-1");
    expect(localeEditDraftKey("survey-1", "locale-1")).toBe("locale:edit:survey-1:locale-1");
    expect(observationDraftKey("survey-1", "locale-1")).toBe("observation:new:survey-1:locale-1");
    expect(observationEditDraftKey("survey-1", "locale-1", "observation-1"))
      .toBe("observation:edit:survey-1:locale-1:observation-1");
  });

  it("rejects malformed records in a format-v5 backup", () => {
    const backup = {
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
      locales: [locale],
      observations: [],
    };

    expect(() => parseSurveyBackup({
      ...backup,
      survey: { ...backup.survey, status: "unknown" },
    })).toThrow("ogiltig inventering");
    expect(() => parseSurveyBackup({
      ...backup,
      locales: [{ ...locale, position: { latitude: 57.7, longitude: 11.9 } }],
    })).toThrow("ogiltig lokal");
    expect(() => parseSurveyBackup({
      ...backup,
      locales: [{ ...locale, surveyId: "survey-2" }],
    })).toThrow("annan inventering");
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
