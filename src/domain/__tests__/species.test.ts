import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";

import { speciesKey, taxonomySpeciesSnapshot } from "../species";

describe("species identity", () => {
  it("deduplicates free-text names case-, whitespace-, and accent-insensitively", () => {
    expect(speciesKey({ source: "free-text", enteredName: "  Ängsvädd " })).toBe(
      speciesKey({ source: "free-text", enteredName: "angsvadd" }),
    );
  });

  it("scopes taxonomy identities to their package and snapshots names", () => {
    const snapshot = taxonomySpeciesSnapshot(
      {
        id: "taxon-1",
        preferredName: "Ängsvädd",
        scientificName: "Succisa pratensis",
        synonyms: [],
        rank: "art",
        status: "accepterad",
      },
      VASCULAR_PLANTS_TAXONOMY,
    );

    expect(speciesKey(snapshot)).toBe("taxonomy:vascular-plants-starter:taxon-1");
    expect(snapshot).toMatchObject({
      preferredName: "Ängsvädd",
      scientificName: "Succisa pratensis",
      taxonomyVersion: VASCULAR_PLANTS_TAXONOMY.version,
    });
  });
});
