import { defaultLocalityName } from "../locality";

describe("locality defaults", () => {
  it("uses the last created observation locality when available", () => {
    expect(defaultLocalityName("  Södra kärret  ", "Inventeringens titel")).toBe("Södra kärret");
  });

  it("falls back to the survey title for the first observation", () => {
    expect(defaultLocalityName(null, "  Ängsmark vid Lillåsen ")).toBe("Ängsmark vid Lillåsen");
  });
});
