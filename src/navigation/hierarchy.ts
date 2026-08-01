import type { Href, ImperativeRouter } from "expo-router";

type HierarchyRouter = Pick<ImperativeRouter, "dismissTo">;

export function dismissToSurveyList(router: HierarchyRouter): void {
  router.dismissTo("/surveys");
}

export function dismissToSurvey(router: HierarchyRouter, surveyId: string): void {
  router.dismissTo({ pathname: "/surveys/[surveyId]", params: { surveyId } });
}

export function dismissToLocale(
  router: HierarchyRouter,
  surveyId: string,
  localeId: string,
): void {
  router.dismissTo({
    pathname: "/surveys/[surveyId]/locales/[localeId]",
    params: { surveyId, localeId },
  });
}

export function dismissToSpeciesLists(router: HierarchyRouter): void {
  router.dismissTo("/species-lists" as Href);
}

export function dismissToSpeciesList(router: HierarchyRouter, listId: string): void {
  router.dismissTo({ pathname: "/species-lists/[listId]", params: { listId } } as unknown as Href);
}
