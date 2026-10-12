import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import { registerRepositoryContract } from "./repositoryContract";
import {
  freshLocaleInput,
  freshObservationInput,
  freshSurveyDraft,
  resetDeterministicIds,
  type ContractRepository,
} from "./repositoryTestFixtures";
import { SqliteTestAdapter } from "./sqliteTestAdapter";

function freshNativeRepository(database = new SqliteTestAdapter()) {
  jest.resetModules();
  resetDeterministicIds();
  jest.doMock("expo-sqlite", () => ({
    openDatabaseAsync: jest.fn(async () => database),
    importDatabaseFromAssetAsync: jest.fn(async () => undefined),
  }));
  const repository = jest.requireActual("../database") as typeof import("../database");
  return { repository, database };
}

registerRepositoryContract("native SQLite", async () => {
  const { repository } = freshNativeRepository();
  await repository.getDatabase();
  return repository as ContractRepository;
});

describe("native SQLite startup", () => {
  it("initializes the current schema directly and reopens v6 data", async () => {
    const { repository, database } = freshNativeRepository();
    await repository.getDatabase();

    expect(await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      .toEqual({ user_version: 6 });
    const expectedColumns: Record<string, string[]> = {
      surveys: [
        "id", "title", "description", "taxonomy_json", "survey_date", "status",
        "created_at", "updated_at", "species_list_id",
      ],
      locales: [
        "id", "survey_id", "name", "observed_at", "time_zone", "latitude", "longitude",
        "rt90_northing", "rt90_easting", "accuracy_meters", "position_source", "note",
        "created_at", "updated_at", "use_locale_time_by_default",
        "use_locale_position_by_default",
      ],
      observations: [
        "id", "locale_id", "observed_at_override", "time_zone_override", "latitude_override",
        "longitude_override", "rt90_northing_override", "rt90_easting_override",
        "accuracy_meters_override", "position_source_override", "species_json", "amount_value",
        "amount_unit", "public_comment", "additional_observers_json", "created_at", "updated_at",
      ],
      species_lists: ["id", "name", "taxonomy_json", "created_at", "updated_at"],
      species_list_entries: [
        "id", "species_list_id", "species_key", "taxon_id", "species_json", "created_at",
      ],
      drafts: ["key", "value_json", "updated_at"],
      app_settings: ["id", "default_taxonomy_package_id"],
      achievements: ["achievement_id", "achieved_at", "acknowledged_at"],
    };
    for (const [table, expected] of Object.entries(expectedColumns)) {
      const columns = await database.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${table})`,
      );
      expect(columns.map((column) => column.name)).toEqual(expected);
    }
    expect(await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE name = 'taxon_search'",
    )).toEqual({ name: "taxon_search" });
    expect((await repository.getAppSettings()).defaultTaxonomyPackageId)
      .toBe(VASCULAR_PLANTS_TAXONOMY.packageId);

    const survey = await repository.createSurvey(freshSurveyDraft("Beständig inventering"));
    const reopened = freshNativeRepository(database).repository;
    await reopened.getDatabase();
    expect(await reopened.getSurvey(survey.id)).toMatchObject({ title: "Beständig inventering" });
  });

  it("cleans unsupported amounts and drafts when opening current-schema data", async () => {
    const initial = freshNativeRepository();
    const { repository, database } = initial;
    await repository.getDatabase();
    const survey = await repository.createSurvey(freshSurveyDraft());
    const locale = await repository.createLocale(freshLocaleInput(survey.id));
    const unsupported = await repository.createObservation(
      freshObservationInput(survey.id, locale, {
        amount: { value: 1, unit: "m2" },
      }),
    );
    const supported = await repository.createObservation(
      freshObservationInput(survey.id, locale, {
        species: { source: "free-text", enteredName: "Klockljung" },
        amount: { value: 2, unit: "m2" },
      }),
    );
    await repository.saveDraft("observation:new:unsupported", { unit: "individer" });
    await repository.saveDraft("observation:new:supported", { unit: "m2" });
    await database.runAsync(
      "UPDATE observations SET amount_unit = ? WHERE id = ?",
      "individer",
      unsupported.id,
    );

    const reopened = freshNativeRepository(database).repository;
    await reopened.getDatabase();

    expect((await reopened.listLocaleObservations(locale.id)).map((item) => item.id))
      .toEqual([supported.id]);
    expect(await reopened.loadDraft("observation:new:unsupported")).toBeNull();
    expect(await reopened.loadDraft("observation:new:supported")).toEqual({ unit: "m2" });
    expect(await database.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("continues to reject databases created by a newer app version", async () => {
    const database = new SqliteTestAdapter();
    await database.execAsync("PRAGMA user_version = 7;");
    const { repository } = freshNativeRepository(database);

    await expect(repository.getDatabase()).rejects.toThrow("nyare version");
  });
});
