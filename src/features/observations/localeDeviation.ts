import type { Observation, SurveyLocale } from "@/domain/models";

export function localeDeviationLabel(
  locale: Pick<SurveyLocale, "useLocaleTimeByDefault" | "useLocalePositionByDefault">,
  observation: Pick<Observation, "timeOverridden" | "positionOverridden">,
): string | undefined {
  const timeDeviates = locale.useLocaleTimeByDefault && observation.timeOverridden;
  const positionDeviates =
    locale.useLocalePositionByDefault && observation.positionOverridden;
  if (timeDeviates && positionDeviates) return "tid och position";
  if (timeDeviates) return "tid";
  if (positionDeviates) return "position";
  return undefined;
}
