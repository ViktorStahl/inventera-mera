import type { ImperativeRouter } from "expo-router";

import {
  dismissToLocale,
  dismissToSpeciesList,
  dismissToSpeciesLists,
  dismissToSurvey,
  dismissToSurveyList,
} from "../hierarchy";

describe("hierarchical navigation", () => {
  const dismissTo = jest.fn();
  const router = { dismissTo } as unknown as ImperativeRouter;

  beforeEach(() => dismissTo.mockClear());

  it("returns a survey to the survey list", () => {
    dismissToSurveyList(router);
    expect(dismissTo).toHaveBeenCalledWith("/surveys");
  });

  it("returns a locale or survey form to its survey", () => {
    dismissToSurvey(router, "survey-1");
    expect(dismissTo).toHaveBeenCalledWith({
      pathname: "/surveys/[surveyId]",
      params: { surveyId: "survey-1" },
    });
  });

  it("returns an observation form to its locale", () => {
    dismissToLocale(router, "survey-1", "locale-1");
    expect(dismissTo).toHaveBeenCalledWith({
      pathname: "/surveys/[surveyId]/locales/[localeId]",
      params: { surveyId: "survey-1", localeId: "locale-1" },
    });
  });

  it("returns species-list forms to their canonical list hierarchy", () => {
    dismissToSpeciesLists(router);
    expect(dismissTo).toHaveBeenLastCalledWith("/species-lists");

    dismissToSpeciesList(router, "list-1");
    expect(dismissTo).toHaveBeenLastCalledWith({
      pathname: "/species-lists/[listId]",
      params: { listId: "list-1" },
    });
  });
});
