import type { Observation, Region, SurveyDraft, SurveyLocale } from "@/domain/models";
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
      schemaVersion: 1,
      surveys: [],
      observations: [],
      drafts: { "observation:new:legacy": { localityName: "Gammalt utkast" } },
    }));
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
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
      countyCode: "14",
      municipalityCode: "1480",
      regionFreeText: "Lillåsen",
      taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
      speciesListId: speciesList.id,
    };
    const region: Region = {
      countyCode: "14",
      countyName: "Västra Götalands län",
      municipalityCode: "1480",
      municipalityName: "Göteborg",
      freeText: "Lillåsen",
      source: "SCB",
      sourceVersion: "2026",
    };

    expect(await repository.loadDraft("observation:new:legacy")).toBeNull();
    await repository.saveDraft("survey:new", draft);
    expect(await repository.loadDraft("survey:new")).toEqual(draft);
    const survey = await repository.createSurvey(draft, region);
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
      amount: { value: 2, unit: "individer" },
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
      formatVersion: 3,
      locales: [{ id: locale.id }],
      speciesList: { list: { id: speciesList.id }, entries: expect.any(Array) },
    });
    expect(backup.locales[0]).not.toHaveProperty("observationCount");
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

    expect(await repository.restoreSurveyBackup(backup)).toBe(survey.id);
    expect(
      await repository.speciesListContains(speciesList.id, {
        source: "free-text",
        enteredName: "Tillagd efter backup",
      }),
    ).toBe(true);
    expect(await repository.listLocales(survey.id)).toHaveLength(1);
    expect(await repository.listObservations(survey.id)).toHaveLength(2);
    await repository.deleteSpeciesList(speciesList.id);
    expect((await repository.getSurvey(survey.id))?.speciesListId).toBeUndefined();
    expect(await repository.listObservations(survey.id)).toHaveLength(2);
    await repository.saveDraft(repository.observationDraftKey(survey.id, locale.id), { speciesQuery: "Ny" });
    await repository.deleteSurvey(survey.id);
    expect(await repository.getSurvey(survey.id)).toBeNull();
    expect(await repository.listLocales(survey.id)).toEqual([]);
    expect(await repository.listObservations(survey.id)).toEqual([]);
    expect(await repository.loadDraft(repository.observationDraftKey(survey.id, locale.id))).toBeNull();
  });
});
