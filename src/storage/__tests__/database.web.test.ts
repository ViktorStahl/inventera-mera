import type { Region, SurveyDraft } from "@/domain/models";
import * as repository from "../database.web";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("browser storage", () => {
  it("persists surveys, drafts and accent-insensitive taxonomy search", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
    const draft: SurveyDraft = {
      title: "Ängsmark",
      description: "",
      surveyDate: "2026-07-31",
      countyCode: "14",
      municipalityCode: "1480",
      regionFreeText: "Lillåsen",
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

    await repository.saveDraft("survey:new", draft);
    expect(await repository.loadDraft("survey:new")).toEqual(draft);
    const saved = await repository.createSurvey(draft, region);
    expect((await repository.listSurveys())[0]?.id).toBe(saved.id);
    expect(await repository.loadDraft("survey:new")).toBeNull();
    expect((await repository.searchTaxa("angsvadd"))[0]?.preferredName).toBe("Ängsvädd");
  });
});
