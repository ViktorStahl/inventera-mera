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
    const initial = freshBrowserRepository(storage).repository;
    const survey = await initial.createSurvey(freshSurveyDraft());
    const locale = await initial.createLocale(freshLocaleInput(survey.id));
    const invalid = await initial.createObservation(
      freshObservationInput(survey.id, locale, { amount: { value: 1, unit: "m2" } }),
    );
    const valid = await initial.createObservation(
      freshObservationInput(survey.id, locale, {
        species: { source: "free-text", enteredName: "Klockljung" },
        amount: { value: 2, unit: "m2" },
      }),
    );
    await initial.saveDraft("observation:new:invalid", { unit: "individer" });
    await initial.saveDraft("observation:new:valid", { unit: "m2" });
    const stored = JSON.parse(storage.getItem("inventera-mera:web:v1") ?? "{}") as {
      observations: Observation[];
    };
    const invalidObservation = stored.observations.find((item) => item.id === invalid.id);
    if (!invalidObservation) throw new Error("Testobservationen saknas.");
    invalidObservation.amount = {
      value: 1,
      unit: "individer",
    } as unknown as Observation["amount"];
    storage.setItem("inventera-mera:web:v1", JSON.stringify(stored));

    const { repository } = freshBrowserRepository(storage);

    const database = await repository.getDatabase();

    expect(database.observations.map((observation) => observation.id)).toEqual([valid.id]);
    expect(database.drafts).toEqual({ "observation:new:valid": { unit: "m2" } });
  });

  it("rejects malformed current-schema records instead of accepting partial data", async () => {
    const storage = new MemoryStorage();
    const initial = freshBrowserRepository(storage).repository;
    await initial.getDatabase();
    const stored = JSON.parse(storage.getItem("inventera-mera:web:v1") ?? "{}") as {
      surveys: unknown[];
    };
    stored.surveys.push({ id: "partial-survey", title: "Ofullständig" });
    storage.setItem("inventera-mera:web:v1", JSON.stringify(stored));

    const repository = freshBrowserRepository(storage).repository;
    await expect(repository.getDatabase()).rejects.toThrow("äldre eller ogiltigt format");
  });

  it("rejects current-schema records with broken ownership relationships", async () => {
    const storage = new MemoryStorage();
    const initial = freshBrowserRepository(storage).repository;
    const survey = await initial.createSurvey(freshSurveyDraft());
    await initial.createLocale(freshLocaleInput(survey.id));
    const stored = JSON.parse(storage.getItem("inventera-mera:web:v1") ?? "{}") as {
      surveys: unknown[];
    };
    stored.surveys = [];
    storage.setItem("inventera-mera:web:v1", JSON.stringify(stored));

    const repository = freshBrowserRepository(storage).repository;
    await expect(repository.getDatabase()).rejects.toThrow("äldre eller ogiltigt format");
  });

  it("does not expose a failed localStorage write through the in-memory cache", async () => {
    class QuotaStorage extends MemoryStorage {
      failWrites = false;

      setItem(key: string, value: string): void {
        if (this.failWrites) throw new DOMException("Full", "QuotaExceededError");
        super.setItem(key, value);
      }
    }

    const storage = new QuotaStorage();
    const repository = freshBrowserRepository(storage).repository;
    await repository.getDatabase();
    storage.failWrites = true;

    await expect(repository.createSurvey(freshSurveyDraft())).rejects.toThrow("lagringsutrymme");
    storage.failWrites = false;
    expect(await repository.listSurveys()).toEqual([]);
    expect(JSON.parse(storage.getItem("inventera-mera:web:v1") ?? "{}").surveys).toEqual([]);
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
