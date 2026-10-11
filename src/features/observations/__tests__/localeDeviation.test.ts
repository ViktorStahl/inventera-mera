import { localeDeviationLabel } from "../localeDeviation";

describe("locale deviation label", () => {
  it("hides overrides that are the locale's configured default", () => {
    expect(localeDeviationLabel(
      { useLocaleTimeByDefault: false, useLocalePositionByDefault: false },
      { timeOverridden: true, positionOverridden: true },
    )).toBeUndefined();
  });

  it("only reports overrides for values configured to follow the locale", () => {
    expect(localeDeviationLabel(
      { useLocaleTimeByDefault: true, useLocalePositionByDefault: false },
      { timeOverridden: true, positionOverridden: true },
    )).toBe("tid");
    expect(localeDeviationLabel(
      { useLocaleTimeByDefault: false, useLocalePositionByDefault: true },
      { timeOverridden: true, positionOverridden: true },
    )).toBe("position");
    expect(localeDeviationLabel(
      { useLocaleTimeByDefault: true, useLocalePositionByDefault: true },
      { timeOverridden: true, positionOverridden: true },
    )).toBe("tid och position");
  });

  it("does not report values that still follow the locale", () => {
    expect(localeDeviationLabel(
      { useLocaleTimeByDefault: true, useLocalePositionByDefault: true },
      { timeOverridden: false, positionOverridden: false },
    )).toBeUndefined();
  });
});
