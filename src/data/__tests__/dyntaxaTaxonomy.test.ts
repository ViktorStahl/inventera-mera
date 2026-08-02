import taxonomy from "../generated/dyntaxaVascularPlants.json";
import manifest from "../generated/dyntaxaVascularPlants.manifest.json";

type PackagedTaxon = [
  id: string,
  preferredName: string,
  scientificName: string,
  synonyms: string[],
  rank: "art" | "underart",
  status: "accepted",
];

const taxa = taxonomy.taxa as PackagedTaxon[];

describe("bundled Dyntaxa vascular-plant taxonomy", () => {
  it("matches its manifest and contains unique accepted species and subspecies", () => {
    expect(taxa).toHaveLength(manifest.entryCount);
    expect(new Set(taxa.map((taxon) => taxon[0])).size).toBe(taxa.length);
    expect(manifest.rootTaxonId).toBe("urn:lsid:dyntaxa.se:Taxon:6000506");
    expect(manifest.includedRawRanks).toEqual(["species", "subspecies"]);

    const rankCounts = { art: 0, underart: 0 };
    for (const taxon of taxa) {
      expect(taxon[0]).toMatch(/^urn:lsid:dyntaxa\.se:Taxon:\d+$/);
      expect(["art", "underart"]).toContain(taxon[4]);
      expect(taxon[5]).toBe("accepted");
      rankCounts[taxon[4]] += 1;
    }
    expect(rankCounts).toEqual(manifest.rankCounts);
  });

  it("uses Swedish names while retaining scientific synonyms as search aliases", () => {
    const meadowDevilsBit = taxa.find((taxon) => taxon[2] === "Succisa pratensis");
    expect(meadowDevilsBit).toEqual([
      "urn:lsid:dyntaxa.se:Taxon:221046",
      "ängsvädd",
      "Succisa pratensis",
      ["Knappvädd", "Scabiosa succisa", "Succisa praemorsa"],
      "art",
      "accepted",
    ]);
  });

  it("excludes higher ranks and a known moss", () => {
    expect(taxa.some((taxon) => taxon[2] === "Tracheophyta")).toBe(false);
    expect(taxa.some((taxon) => taxon[2] === "Funaria hygrometrica")).toBe(false);
  });
});
