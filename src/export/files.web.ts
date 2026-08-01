import type { SurveyBackup } from "@/domain/models";
import { getSpeciesList, getSurvey, listLocales, listObservations } from "@/storage/database";
import { createSurveyWorkbook, sanitizeFileName } from "./xlsx";

export async function shareSurveyExcel(surveyId: string): Promise<string> {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  const [locales, observations, speciesList] = await Promise.all([
    listLocales(surveyId),
    listObservations(surveyId),
    survey.speciesListId ? getSpeciesList(survey.speciesListId) : Promise.resolve(null),
  ]);
  const name = `${sanitizeFileName(survey.title)}_${survey.surveyDate}.xlsx`;
  const workbook = createSurveyWorkbook(survey, locales, observations, speciesList ?? undefined);
  download(
    name,
    new Blob([Uint8Array.from(workbook).buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  return name;
}

export async function shareSurveyBackup(backup: SurveyBackup): Promise<string> {
  const name = `${sanitizeFileName(backup.survey.title)}_${backup.survey.surveyDate}.json`;
  download(
    name,
    new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  return name;
}

export async function readJsonFile(uri: string): Promise<unknown> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Backupfilen kunde inte läsas.");
  return JSON.parse(await response.text()) as unknown;
}

function download(name: string, blob: Blob): void {
  const uri = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = uri;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(uri), 1_000);
}
