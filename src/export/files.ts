import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { SurveyBackup } from "@/domain/models";
import { getSurvey, listLocales, listObservations } from "@/storage/database";
import { createSurveyWorkbook, sanitizeFileName } from "./xlsx";

export async function shareSurveyExcel(surveyId: string): Promise<string> {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  const [locales, observations] = await Promise.all([
    listLocales(surveyId),
    listObservations(surveyId),
  ]);
  const name = `${sanitizeFileName(survey.title)}_${survey.surveyDate}.xlsx`;
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(createSurveyWorkbook(survey, locales, observations));
  await share(file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return file.uri;
}

export async function shareSurveyBackup(backup: SurveyBackup): Promise<string> {
  const name = `${sanitizeFileName(backup.survey.title)}_${backup.survey.surveyDate}.json`;
  const file = new File(Paths.document, name);
  file.create({ overwrite: true });
  file.write(JSON.stringify(backup, null, 2));
  await share(file, "application/json");
  return file.uri;
}

export async function readJsonFile(uri: string): Promise<unknown> {
  const file = new File(uri);
  return JSON.parse(await file.text()) as unknown;
}

async function share(file: File, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(`Filen sparades på enheten: ${file.uri}`);
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: "Dela fil" });
}
