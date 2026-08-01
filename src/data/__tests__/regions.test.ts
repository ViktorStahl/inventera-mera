import { REGION_OPTIONS, findRegion, searchRegions } from "../regions";

describe("SCB regions", () => {
  it("contains 21 counties and 290 municipalities", () => {
    expect(REGION_OPTIONS.filter((item) => !item.municipalityCode)).toHaveLength(21);
    expect(REGION_OPTIONS.filter((item) => item.municipalityCode)).toHaveLength(290);
  });

  it("searches accent-insensitively and retains county context", () => {
    const result = searchRegions("alvsbyn").find((item) => item.municipalityCode === "2560");
    expect(result?.municipalityName).toBe("Älvsbyn");
    expect(result?.countyName).toBe("Norrbottens län");
  });

  it("resolves a selected municipality", () => {
    expect(findRegion("25", "2582")?.label).toBe("Boden, Norrbottens län");
  });
});
