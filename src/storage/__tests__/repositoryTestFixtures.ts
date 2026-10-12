import type { Observation, SurveyDraft, SurveyLocale } from "@/domain/models";
import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";

export type ContractRepository = Pick<
  typeof import("../database.web"),
  | "createSurvey"
  | "createLocale"
  | "createObservation"
  | "listLocaleObservations"
  | "updateLocale"
  | "createSpeciesList"
  | "speciesListContains"
  | "buildSurveyBackup"
  | "restoreSurveyBackup"
  | "archiveSurvey"
  | "restoreSurvey"
  | "deleteSurvey"
  | "deleteLocale"
  | "getSurvey"
  | "listLocales"
  | "listObservations"
>;

let nextId = 0;

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }

  clear(): void { this.values.clear(); }

  getItem(key: string): string | null { return this.values.get(key) ?? null; }

  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }

  removeItem(key: string): void { this.values.delete(key); }

  setItem(key: string, value: string): void { this.values.set(key, value); }
}

export function resetDeterministicIds(): void {
  nextId = 0;
  jest.doMock("expo-crypto", () => ({ randomUUID: () => `test-id-${++nextId}` }));
}

export function freshBrowserRepository(storage = new MemoryStorage()) {
  jest.resetModules();
  resetDeterministicIds();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  const repository = jest.requireActual("../database.web") as typeof import("../database.web");
  return { repository, storage };
}

export function freshSurveyDraft(title = "Fältinventering"): SurveyDraft {
  return {
    title,
    description: "",
    surveyDate: "2026-10-12",
    taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
    speciesListId: "",
  };
}

export function freshLocaleInput(
  surveyId: string,
  name = "Lillåsen",
): Omit<SurveyLocale, "id" | "createdAt" | "updatedAt"> {
  return {
    surveyId,
    name,
    observedAt: "2026-10-12T09:00:00+02:00",
    timeZone: "Europe/Stockholm",
    position: {
      wgs84: { latitude: 57.7, longitude: 11.9 },
      rt90: { northing: 6_400_000, easting: 1_300_000, crs: "EPSG:3847" },
      accuracyMeters: 4,
      source: "manual-rt90",
    },
    useLocaleTimeByDefault: false,
    useLocalePositionByDefault: false,
  };
}

export function freshObservationInput(
  surveyId: string,
  locale: SurveyLocale,
  overrides: Partial<Omit<Observation, "id" | "createdAt" | "updatedAt">> = {},
): Omit<Observation, "id" | "createdAt" | "updatedAt"> {
  return {
    surveyId,
    localeId: locale.id,
    localityName: locale.name,
    observedAt: locale.observedAt,
    timeZone: locale.timeZone,
    position: locale.position,
    timeOverridden: false,
    positionOverridden: false,
    species: { source: "free-text", enteredName: "Ängsvädd" },
    additionalObservers: [],
    ...overrides,
  };
}
