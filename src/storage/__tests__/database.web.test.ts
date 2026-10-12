import type { Observation } from "@/domain/models";
import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import { taxonomySpeciesSnapshot } from "@/domain/species";
import { registerRepositoryContract } from "./repositoryContract";
import {
  freshBrowserRepository,
  freshLocaleInput,
  freshObservationInput,
  freshSurveyDraft,
  MemoryStorage,
} from "./repositoryTestFixtures";

registerRepositoryContract("browser", () => freshBrowserRepository().repository);

describe("browser storage", () => {
  it("initializes an empty store directly at schema v6 and persists it", async () => {
    const storage = new MemoryStorage();
    const { repository } = freshBrowserRepository(storage);

    expect((await repository.getDatabase()).schemaVersion).toBe(6);
    expect(JSON.parse(storage.getItem("inventera-mera:web:v1") ?? "{}").schemaVersion).toBe(6);

    const reloaded = freshBrowserRepository(storage).repository;
    expect((await reloaded.getDatabase()).schemaVersion).toBe(6);
  });

  it("cleans incompatible amounts and drafts from current-schema data", async () => {
    const storage = new MemoryStorage();
    storage.setItem("inventera-mera:web:v1", JSON.stringify({
      schemaVersion: 6,
      surveys: [],
      locales: [],
      observations: [
        { id: "invalid", amount: { value: 1, unit: "individer" } },
        { id: "valid", amount: { value: 2, unit: "m2" } },
      ],
      speciesLists: [],
      speciesListEntries: [],
      settings: { defaultTaxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId },
      achievements: [],
      drafts: {
        "observation:new:invalid": { unit: "individer" },
        "observation:new:valid": { unit: "m2" },
      },
    }));
    const { repository } = freshBrowserRepository(storage);

    const database = await repository.getDatabase();

    expect(database.observations.map((observation) => observation.id)).toEqual(["valid"]);
    expect(database.drafts).toEqual({ "observation:new:valid": { unit: "m2" } });
  });

  it("prioritizes list taxonomy matches and includes free-text list entries", async () => {
    const { repository } = freshBrowserRepository();
    const list = await repository.createSpeciesList("Ängsväxter", VASCULAR_PLANTS_TAXONOMY);
    const taxon = (await repository.searchTaxa("ängskovall"))[0];
    expect(taxon).toBeDefined();
    await repository.addSpeciesToList(
      list.id,
      taxonomySpeciesSnapshot(taxon!, VASCULAR_PLANTS_TAXONOMY),
    );
    await repository.addSpeciesToList(list.id, {
      source: "free-text",
      enteredName: "Okänd ängsväxt",
    });

    expect((await repository.searchTaxa("äng", 20, list.id))[0]).toMatchObject({
      id: taxon!.id,
      inSpeciesList: true,
    });
    expect((await repository.searchTaxa("okänd", 20, list.id))[0]).toMatchObject({
      source: "free-text",
      preferredName: "Okänd ängsväxt",
      inSpeciesList: true,
    });
  });

  it("summarizes active and archived observations and drops deleted records", async () => {
    const { repository } = freshBrowserRepository();
    const active = await repository.createSurvey(freshSurveyDraft("Aktiv"));
    const archived = await repository.createSurvey(freshSurveyDraft("Arkiverad"));
    const activeLocale = await repository.createLocale(freshLocaleInput(active.id, "Aktiv lokal"));
    const archivedLocale = await repository.createLocale(
      freshLocaleInput(archived.id, "Arkiverad lokal"),
    );
    await repository.createObservation(freshObservationInput(active.id, activeLocale));
    await repository.createObservation(freshObservationInput(archived.id, archivedLocale));
    await repository.archiveSurvey(archived.id);

    expect((await repository.getStatisticsSummary()).totalObservations).toBe(2);
    await repository.deleteSurvey(archived.id);
    expect((await repository.getStatisticsSummary()).totalObservations).toBe(1);
  });

  it("persists achievement awards across browser module reloads", async () => {
    const storage = new MemoryStorage();
    const { repository } = freshBrowserRepository(storage);
    const survey = await repository.createSurvey(freshSurveyDraft("Morotsinventering"));
    const locale = await repository.createLocale(freshLocaleInput(survey.id));
    const carrot = (await repository.searchTaxa("morot"))
      .find((taxon) => taxon.id === "urn:lsid:dyntaxa.se:Taxon:219664");
    expect(carrot).toBeDefined();
    const observation: Omit<Observation, "id" | "createdAt" | "updatedAt"> = {
      ...freshObservationInput(survey.id, locale),
      species: taxonomySpeciesSnapshot(carrot!, VASCULAR_PLANTS_TAXONOMY),
    };
    await repository.createObservation(observation);

    expect((await repository.evaluateAchievements()).map((award) => award.achievementId))
      .toContain("first-morot");
    await repository.acknowledgeAchievement("first-morot");

    const reloaded = freshBrowserRepository(storage).repository;
    expect(await reloaded.listAchievementAwards()).toEqual([
      expect.objectContaining({
        achievementId: "first-morot",
        acknowledgedAt: expect.any(String),
      }),
    ]);
  });
});
