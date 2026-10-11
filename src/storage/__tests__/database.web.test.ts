import type { Observation, SurveyDraft, SurveyLocale } from "@/domain/models";
import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import { taxonomySpeciesSnapshot } from "@/domain/species";
import * as repository from "../database.web";

let mockNextId = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `id-${++mockNextId}` }));

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("browser storage", () => {
  it("persists the survey-locale-observation hierarchy and resolves live inheritance offline", async () => {
    const storage = new MemoryStorage();
    storage.setItem("inventera-mera:web:v1", JSON.stringify({
      schemaVersion: 3,
      surveys: [{
        id: "legacy-survey",
        title: "Äldre inventering",
        region: {
          countyCode: "14",
          countyName: "Västra Götalands län",
          source: "SCB",
          sourceVersion: "2026",
        },
        taxonomyRef: VASCULAR_PLANTS_TAXONOMY,
        surveyDate: "2026-07-30",
        status: "active",
        createdAt: "2026-07-30T08:00:00.000Z",
        updatedAt: "2026-07-30T08:00:00.000Z",
      }],
      locales: [{
        id: "legacy-locale",
        surveyId: "legacy-survey",
        name: "Äldre lokal",
        observedAt: "2026-07-30T09:00:00+02:00",
        timeZone: "Europe/Stockholm",
        position: {
          wgs84: { latitude: 57.7, longitude: 11.9 },
          rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" },
          source: "manual-rt90",
        },
        createdAt: "2026-07-30T07:00:00.000Z",
        updatedAt: "2026-07-30T07:00:00.000Z",
      }],
      observations: [{ id: "ogiltig", amount: { value: 1, unit: "individer" } }],
      speciesLists: [],
      speciesListEntries: [],
      settings: { defaultTaxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId },
      drafts: {
        "survey:new": { title: "Gammalt regionutkast", countyCode: "14" },
        "observation:new:legacy": { amount: "1", unit: "individer" },
      },
    }));
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const migratedDatabase = await repository.getDatabase();
    expect(migratedDatabase.schemaVersion).toBe(5);
    expect(migratedDatabase.surveys[0]).not.toHaveProperty("region");
    expect(migratedDatabase.locales[0]).toMatchObject({
      useLocaleTimeByDefault: false,
      useLocalePositionByDefault: false,
    });
    expect(migratedDatabase.observations).toEqual([]);
    expect(await repository.loadDraft("survey:new")).toBeNull();
    await repository.archiveSurvey("legacy-survey");
    await repository.deleteSurvey("legacy-survey");
    const speciesList = await repository.createSpeciesList("Fjällväxter", VASCULAR_PLANTS_TAXONOMY);
    const listTaxon = (await repository.searchTaxa("ängskovall"))[0]!;
    await repository.addSpeciesToList(
      speciesList.id,
      taxonomySpeciesSnapshot(listTaxon, VASCULAR_PLANTS_TAXONOMY),
    );
    const prioritized = await repository.searchTaxa("äng", 20, speciesList.id);
    expect(prioritized[0]).toMatchObject({ id: listTaxon.id, inSpeciesList: true });
    await repository.addSpeciesToList(speciesList.id, {
      source: "taxonomy",
      enteredName: "Okänd fjällväxt",
      taxonId: "not-in-active-starter-package",
      preferredName: "Okänd fjällväxt",
      scientificName: "Planta incognita",
      taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
      taxonomyVersion: "äldre-version",
    });
    expect((await repository.searchTaxa("okänd", 20, speciesList.id))[0]).toMatchObject({
      id: "not-in-active-starter-package",
      taxonomyVersion: "äldre-version",
      inSpeciesList: true,
    });

    const draft: SurveyDraft = {
      title: "Ängsmark",
      description: "",
      surveyDate: "2026-07-31",
      taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
      speciesListId: speciesList.id,
    };

    expect(await repository.loadDraft("observation:new:legacy")).toBeNull();
    await repository.saveDraft("survey:new", draft);
    expect(await repository.loadDraft("survey:new")).toEqual(draft);
    const survey = await repository.createSurvey(draft);
    expect((await repository.listSurveys())[0]).toMatchObject({ id: survey.id, localeCount: 0, observationCount: 0 });
    expect(await repository.loadDraft("survey:new")).toBeNull();
    expect((await repository.searchTaxa("angsvadd"))[0]?.preferredName).toBe("ängsvädd");
    expect((await repository.searchTaxa("Scabiosa succisa"))[0]).toMatchObject({
      preferredName: "ängsvädd",
      scientificName: "Succisa pratensis",
    });

    const localeInput: Omit<SurveyLocale, "id" | "createdAt" | "updatedAt"> = {
      surveyId: survey.id,
      name: "Lillåsen nord",
      observedAt: "2026-07-31T10:00:00+02:00",
      timeZone: "Europe/Stockholm",
      position: {
        wgs84: { latitude: 57.7089, longitude: 11.9746 },
        rt90: { northing: 6404152, easting: 1271480, crs: "EPSG:3847" },
        accuracyMeters: 4,
        source: "device",
      },
      note: "Vid stigen",
      useLocaleTimeByDefault: false,
      useLocalePositionByDefault: false,
    };
    await repository.saveDraft(repository.localeDraftKey(survey.id), { name: "utkast" });
    const locale = await repository.createLocale(localeInput);
    expect(await repository.loadDraft(repository.localeDraftKey(survey.id))).toBeNull();
    expect((await repository.listSurveys())[0]).toMatchObject({ localeCount: 1, observationCount: 0 });

    const inheritedInput: Omit<Observation, "id" | "createdAt" | "updatedAt"> = {
      surveyId: survey.id,
      localeId: locale.id,
      observedAt: locale.observedAt,
      timeZone: locale.timeZone,
      localityName: locale.name,
      timeOverridden: false,
      position: locale.position,
      positionOverridden: false,
      species: { source: "free-text", enteredName: "Testväxt" },
      amount: { value: 2, unit: "stjälkar/strån/skott" },
      publicComment: "Första kommentaren",
      additionalObservers: ["Ada"],
    };
    const inherited = await repository.createObservation(inheritedInput, speciesList.id);
    expect(await repository.getObservation(survey.id, inherited.id)).toEqual(inherited);
    expect(await repository.speciesListContains(speciesList.id, inherited.species)).toBe(true);
    expect((await repository.searchTaxa("testväxt", 20, speciesList.id))[0]).toMatchObject({
      source: "free-text",
      preferredName: "Testväxt",
      inSpeciesList: true,
    });
    await expect(
      repository.createObservation({
        ...inheritedInput,
        amount: { value: 2, unit: "individer" },
      } as unknown as typeof inheritedInput),
    ).rejects.toThrow("tillåtna enheterna");

    const override = await repository.createObservation({
      ...inheritedInput,
      observedAt: "2026-07-31T11:30:00+02:00",
      timeOverridden: true,
      position: {
        ...locale.position,
        rt90: { ...locale.position.rt90, northing: 6404200 },
      },
      positionOverridden: true,
      species: { source: "free-text", enteredName: "Blodrot" },
    });

    await repository.saveDraft(repository.localeEditDraftKey(survey.id, locale.id), { name: "utkast" });
    const movedLocale = await repository.updateLocale(locale.id, {
      ...localeInput,
      name: "Lillåsen norra",
      observedAt: "2026-08-01T09:00:00+02:00",
      position: { ...locale.position, rt90: { ...locale.position.rt90, northing: 6404300 } },
    });
    expect(await repository.loadDraft(repository.localeEditDraftKey(survey.id, locale.id))).toBeNull();
    const observations = await repository.listLocaleObservations(locale.id);
    expect(observations.find((item) => item.id === inherited.id)).toMatchObject({
      localityName: movedLocale.name,
      observedAt: movedLocale.observedAt,
      position: { rt90: { northing: 6404300 } },
    });
    expect(observations.find((item) => item.id === override.id)).toMatchObject({
      localityName: movedLocale.name,
      observedAt: "2026-07-31T11:30:00+02:00",
      position: { rt90: { northing: 6404200 } },
    });

    await repository.saveDraft(repository.observationEditDraftKey(survey.id, locale.id, override.id), { speciesQuery: "utkast" });
    const edited = await repository.updateObservation(override.id, { ...inheritedInput, localeId: locale.id, publicComment: "Redigerad" });
    expect(edited.createdAt).toBe(override.createdAt);
    expect(await repository.loadDraft(repository.observationEditDraftKey(survey.id, locale.id, override.id))).toBeNull();

    const backup = await repository.buildSurveyBackup(survey.id);
    expect(backup).toMatchObject({
      formatVersion: 5,
      locales: [{ id: locale.id }],
      speciesList: { list: { id: speciesList.id }, entries: expect.any(Array) },
    });
    expect(backup.locales[0]).not.toHaveProperty("observationCount");
    expect(backup.survey).not.toHaveProperty("region");
    const firstBackedUpEntry = backup.speciesList?.entries[0];
    expect(firstBackedUpEntry).toBeDefined();
    await expect(repository.restoreSurveyBackup({
      ...backup,
      speciesList: {
        ...backup.speciesList,
        entries: [{ ...firstBackedUpEntry, speciesKey: "manipulerad-identitet" }],
      },
    })).rejects.toThrow("ogiltiga poster");
    await repository.addSpeciesToList(speciesList.id, {
      source: "free-text",
      enteredName: "Tillagd efter backup",
    });

    await repository.deleteLocale(survey.id, locale.id);
    expect(await repository.getLocale(survey.id, locale.id)).toBeNull();
    expect(await repository.listObservations(survey.id)).toEqual([]);

    const legacyRegionBackup = {
      ...backup,
      formatVersion: 3,
      survey: {
        ...backup.survey,
        region: {
          countyCode: "14",
          countyName: "Västra Götalands län",
          source: "SCB",
          sourceVersion: "2026",
        },
      },
    };
    expect(await repository.restoreSurveyBackup(legacyRegionBackup)).toBe(survey.id);
    expect(await repository.getSurvey(survey.id)).not.toHaveProperty("region");
    expect(
      await repository.speciesListContains(speciesList.id, {
        source: "free-text",
        enteredName: "Tillagd efter backup",
      }),
    ).toBe(true);
    expect(await repository.listLocales(survey.id)).toHaveLength(1);
    expect(await repository.listObservations(survey.id)).toHaveLength(2);
    const invalidBackupObservation = {
      ...backup.observations[0]!,
      id: "observation-med-ogiltig-enhet",
      amount: { value: 1, unit: "individer" },
    };
    await repository.restoreSurveyBackup({
      ...backup,
      observations: [...backup.observations, invalidBackupObservation],
    });
    expect(await repository.listObservations(survey.id)).toHaveLength(2);
    await repository.deleteSpeciesList(speciesList.id);
    expect((await repository.getSurvey(survey.id))?.speciesListId).toBeUndefined();
    expect(await repository.listObservations(survey.id)).toHaveLength(2);
    await repository.saveDraft(repository.observationDraftKey(survey.id, locale.id), { speciesQuery: "Ny" });
    await repository.archiveSurvey(survey.id);
    await repository.deleteSurvey(survey.id);
    expect(await repository.getSurvey(survey.id)).toBeNull();
    expect(await repository.listLocales(survey.id)).toEqual([]);
    expect(await repository.listObservations(survey.id)).toEqual([]);
    expect(await repository.loadDraft(repository.observationDraftKey(survey.id, locale.id))).toBeNull();
  });
  it("archives before delete, preserves backup status, and keeps archived contents view-only", async () => {
    const surveyDraft: SurveyDraft = { title: "Arkivtest", description: "", surveyDate: "2026-07-31", taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId, speciesListId: "" };
    const survey = await repository.createSurvey(surveyDraft);
    const other = await repository.createSurvey({ ...surveyDraft, title: "Aktiv" });
    const position: SurveyLocale["position"] = { wgs84: { latitude: 57.7, longitude: 11.9 }, rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" }, source: "manual-rt90" };
    const localeInput: Omit<SurveyLocale, "id" | "createdAt" | "updatedAt"> = { surveyId: survey.id, name: "Lokal 1", observedAt: "2026-07-31T10:00:00+02:00", timeZone: "Europe/Stockholm", position, useLocaleTimeByDefault: false, useLocalePositionByDefault: false };
    const locale = await repository.createLocale(localeInput);
    const localeToKeep = await repository.createLocale({ ...localeInput, name: "Lokal 2" });
    const observationInput = (localeId: string): Omit<Observation, "id" | "createdAt" | "updatedAt"> => ({ surveyId: survey.id, localeId, localityName: "Lokal", observedAt: localeInput.observedAt, timeZone: localeInput.timeZone, position, timeOverridden: false, positionOverridden: false, species: { source: "free-text", enteredName: "Ängsvädd" }, additionalObservers: [] });
    const observation = await repository.createObservation(observationInput(locale.id));
    const observationToKeep = await repository.createObservation(observationInput(localeToKeep.id));
    await expect(repository.deleteSurvey(survey.id)).rejects.toThrow("Arkivera inventeringen");
    await repository.archiveSurvey(survey.id);
    expect((await repository.getSurvey(survey.id))?.status).toBe("archived");
    const activeSurveys = await repository.listSurveys();
    expect(activeSurveys.some((item) => item.id === survey.id)).toBe(false);
    expect(activeSurveys.some((item) => item.id === other.id)).toBe(true);
    const visibleSurveys = await repository.listSurveys("Arkivtest", true);
    expect(visibleSurveys).toEqual([expect.objectContaining({ id: survey.id, status: "archived" })]);
    const allSurveys = await repository.listSurveys("", true);
    expect(allSurveys.map((item) => item.id)).toEqual([...allSurveys].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map((item) => item.id));
    const archivedBackup = await repository.buildSurveyBackup(survey.id);
    expect(archivedBackup.survey.status).toBe("archived");
    await repository.restoreSurveyBackup(archivedBackup);
    expect((await repository.getSurvey(survey.id))?.status).toBe("archived");
    await expect(repository.updateSurvey(survey.id, surveyDraft)).rejects.toThrow("Inventeringen är arkiverad");
    await expect(repository.createLocale(localeInput)).rejects.toThrow("Inventeringen är arkiverad");
    await expect(repository.updateLocale(locale.id, localeInput)).rejects.toThrow("Inventeringen är arkiverad");
    await expect(repository.createObservation(observationInput(locale.id))).rejects.toThrow("Inventeringen är arkiverad");
    await expect(repository.updateObservation(observation.id, observationInput(locale.id))).rejects.toThrow("Inventeringen är arkiverad");
    await repository.restoreSurvey(survey.id);
    expect((await repository.listSurveys()).some((item) => item.id === survey.id)).toBe(true);
    await repository.archiveSurvey(survey.id);
    await expect(repository.deleteObservation(survey.id, observation.id)).rejects.toThrow("Inventeringen är arkiverad");
    await expect(repository.deleteLocale(survey.id, locale.id)).rejects.toThrow("Inventeringen är arkiverad");
    expect(await repository.getObservation(survey.id, observation.id)).not.toBeNull();
    expect(await repository.getLocale(survey.id, locale.id)).not.toBeNull();
    expect(await repository.listObservations(survey.id)).toHaveLength(2);
    await repository.restoreSurvey(survey.id);
    await repository.deleteObservation(survey.id, observation.id);
    expect(await repository.getObservation(survey.id, observation.id)).toBeNull();
    await repository.deleteLocale(survey.id, locale.id);
    expect(await repository.getLocale(survey.id, locale.id)).toBeNull();
    expect(await repository.listObservations(survey.id)).toEqual([observationToKeep]);
    await repository.archiveSurvey(survey.id);
    const surveyDraftKey = repository.surveyEditDraftKey(survey.id);
    const observationDraftKey = repository.observationEditDraftKey(survey.id, localeToKeep.id, observationToKeep.id);
    await repository.saveDraft(surveyDraftKey, { title: "utkast" });
    await repository.saveDraft(observationDraftKey, { speciesQuery: "utkast" });
    const cascadeBackup = await repository.buildSurveyBackup(survey.id);
    await repository.deleteSurvey(survey.id);
    expect(await repository.getSurvey(survey.id)).toBeNull();
    expect(await repository.listLocales(survey.id)).toEqual([]);
    expect(await repository.listObservations(survey.id)).toEqual([]);
    expect(await repository.loadDraft(surveyDraftKey)).toBeNull();
    expect(await repository.loadDraft(observationDraftKey)).toBeNull();
    await repository.restoreSurveyBackup(cascadeBackup);
    expect((await repository.getSurvey(survey.id))?.status).toBe("archived");
    expect(await repository.listLocales(survey.id)).toHaveLength(1);
    expect(await repository.listObservations(survey.id)).toHaveLength(1);
    expect((await repository.listSurveys()).some((item) => item.id === survey.id)).toBe(false);
    await repository.deleteSurvey(survey.id);
    expect(await repository.getSurvey(survey.id)).toBeNull();
  });
  it("summarizes active and archived observations and drops them after survey deletion", async () => {
    const before = await repository.getStatisticsSummary();
    const surveyDraft: SurveyDraft = {
      title: "Statistik",
      description: "",
      surveyDate: "2001-01-01",
      taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
      speciesListId: "",
    };
    const activeSurvey = await repository.createSurvey(surveyDraft);
    const emptySurvey = await repository.createSurvey({ ...surveyDraft, title: "Tom inventering" });
    const archivedSurvey = await repository.createSurvey({ ...surveyDraft, title: "Arkiverad statistik" });
    const position: SurveyLocale["position"] = {
      wgs84: { latitude: 57.7, longitude: 11.9 },
      rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" },
      source: "manual-rt90",
    };

    async function createLocale(
      surveyId: string,
      name: string,
      observedAt: string,
      timeZone: string,
    ) {
      return repository.createLocale({
        surveyId,
        name,
        observedAt,
        timeZone,
        position,
        useLocaleTimeByDefault: false,
        useLocalePositionByDefault: false,
      });
    }

    async function createObservation(
      surveyId: string,
      locale: SurveyLocale,
      species: Observation["species"],
      observedAtOverride?: string,
      timeZoneOverride?: string,
    ) {
      return repository.createObservation({
        surveyId,
        localeId: locale.id,
        localityName: locale.name,
        observedAt: observedAtOverride ?? locale.observedAt,
        timeZone: timeZoneOverride ?? locale.timeZone,
        position: locale.position,
        timeOverridden: observedAtOverride !== undefined,
        positionOverridden: false,
        species,
        additionalObservers: [],
      });
    }

    const activeLocale = await createLocale(
      activeSurvey.id,
      "Aktiv lokal",
      "2001-01-31T23:30:00-05:00",
      "America/New_York",
    );
    const archivedLocale = await createLocale(
      archivedSurvey.id,
      "Arkiverad lokal",
      "2001-03-01T00:30:00+01:00",
      "Europe/Stockholm",
    );
    await createObservation(activeSurvey.id, activeLocale, {
      source: "free-text",
      enteredName: "Alm",
    });
    await createObservation(archivedSurvey.id, archivedLocale, {
      source: "free-text",
      enteredName: "Daggkåpa",
    });
    await createObservation(
      archivedSurvey.id,
      archivedLocale,
      { source: "free-text", enteredName: "Daggkåpa" },
      "2001-02-01T00:30:00+01:00",
      "Europe/Stockholm",
    );
    await repository.archiveSurvey(archivedSurvey.id);

    const withArchived = await repository.getStatisticsSummary();
    expect(withArchived.totalObservations).toBe(before.totalObservations + 3);
    expect(withArchived.surveyCount).toBe(before.surveyCount + 3);
    expect(withArchived.averageObservationsPerSurvey).toBe(
      (before.totalObservations + 3) / (before.surveyCount + 3),
    );
    expect(withArchived.observationsByMonth).toContainEqual({
      month: "2001-01",
      observationCount: 1,
    });
    expect(withArchived.observationsByMonth).toContainEqual({
      month: "2001-02",
      observationCount: 1,
    });
    expect(withArchived.observationsByMonth).toContainEqual({
      month: "2001-03",
      observationCount: 1,
    });
    expect(withArchived.topSpecies[0]).toMatchObject({
      name: "Daggkåpa",
      observationCount: 2,
    });
    expect(Object.keys(withArchived).sort()).toEqual([
      "averageObservationsPerSurvey",
      "observationsByMonth",
      "surveyCount",
      "topSpecies",
      "totalObservations",
    ]);

    await repository.deleteSurvey(archivedSurvey.id);
    const afterDeletion = await repository.getStatisticsSummary();
    expect(afterDeletion.totalObservations).toBe(before.totalObservations + 1);
    expect(afterDeletion.surveyCount).toBe(before.surveyCount + 2);
    expect(afterDeletion.topSpecies.some((species) => species.name === "Daggkåpa")).toBe(false);
    expect(await repository.getSurvey(emptySurvey.id)).not.toBeNull();
  });
});
