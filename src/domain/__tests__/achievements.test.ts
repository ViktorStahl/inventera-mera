import {
  ACHIEVEMENT_DEFINITIONS,
  findNewlyEligibleAchievements,
  MOROT_TAXON_ID,
  ORCHIDACEAE_TAXON_ID,
  type AchievementObservation,
  type DyntaxaTaxonMetadata,
} from "../achievements";
import type { SpeciesSnapshot } from "../models";

const packageId = "vascular-plants-starter";

function taxonomySpecies(taxonId: string): SpeciesSnapshot {
  return {
    source: "taxonomy",
    enteredName: "Art " + taxonId,
    taxonId,
    taxonomyPackageId: packageId,
  };
}

function taxonMetadataEntry(
  preferredName: string,
  rank = "art",
  status = "accepted",
  familyTaxonId: string | null = null,
): DyntaxaTaxonMetadata {
  return { preferredName, rank, status, familyTaxonId };
}

function taxonMetadata(
  ids: string[],
  rank = "art",
  status = "accepted",
): Map<string, DyntaxaTaxonMetadata> {
  return new Map(ids.map((id) => [id, taxonMetadataEntry(id, rank, status)]));
}

describe("achievement eligibility", () => {
  it("keeps the current awards and adds the seven catalogued milestones", () => {
    expect(ACHIEVEMENT_DEFINITIONS.map((achievement) => achievement.id)).toEqual([
      "first-morot",
      "hundred-species",
      "thousand-observations",
      "hundred-orchid-species",
      "meadow-prefix-expert",
      "forest-prefix-expert",
      "shore-prefix-expert",
      "mountain-prefix-expert",
      "ten-thousand-observations",
      "thousand-unique-species",
    ]);
    expect(ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "meadow-prefix-expert"))
      .toMatchObject({ title: "Ängsexpert", description: expect.stringContaining("20 olika arter") });
    expect(ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "hundred-orchid-species"))
      .toMatchObject({ description: expect.stringContaining("30 olika orkidéarter") });
  });

  it("unlocks Morot only for the accepted taxonomy species, not free text or subspecies", () => {
    const freeText: AchievementObservation = {
      species: { source: "free-text", enteredName: "morot" },
    };
    const subspecies = taxonomySpecies("urn:dyntaxa:morot-subspecies");
    const morot = taxonomySpecies(MOROT_TAXON_ID);

    expect(findNewlyEligibleAchievements(
      [freeText], new Set(), packageId, taxonMetadata([MOROT_TAXON_ID]),
    )).toEqual([]);
    expect(findNewlyEligibleAchievements(
      [{ species: subspecies }],
      new Set(),
      packageId,
      new Map([[subspecies.taxonId!, taxonMetadataEntry(subspecies.enteredName, "underart")]]),
    )).toEqual([]);
    expect(findNewlyEligibleAchievements(
      [{ species: morot }],
      new Set(),
      packageId,
      taxonMetadata([MOROT_TAXON_ID]),
    )).toEqual(["first-morot"]);
  });

  it("counts 100 distinct accepted species-rank taxa but ignores subspecies and free text", () => {
    const observations: AchievementObservation[] = [];
    const metadata = new Map<string, DyntaxaTaxonMetadata>();
    for (let index = 0; index < 100; index += 1) {
      const taxonId = "taxon-" + index;
      observations.push({ species: taxonomySpecies(taxonId) });
      metadata.set(taxonId, taxonMetadataEntry(taxonId));
    }
    expect(findNewlyEligibleAchievements(
      observations.slice(0, 99), new Set(), packageId, metadata,
    )).not.toContain("hundred-species");

    observations.push({ species: taxonomySpecies("taxon-0") });
    observations.push({ species: { source: "free-text", enteredName: "Fri art" } });
    observations.push({ species: taxonomySpecies("subspecies") });
    metadata.set("subspecies", taxonMetadataEntry("subspecies", "underart"));

    expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
      .toContain("hundred-species");
  });

  it("counts distinct orchid species using Dyntaxa family membership", () => {
    const observations: AchievementObservation[] = [];
    const metadata = new Map<string, DyntaxaTaxonMetadata>();
    for (let index = 0; index < 29; index += 1) {
      const taxonId = "orchid-" + index;
      observations.push({ species: taxonomySpecies(taxonId) });
      metadata.set(
        taxonId,
        taxonMetadataEntry("Orchid " + index, "art", "accepted", ORCHIDACEAE_TAXON_ID),
      );
    }
    observations.push({ species: taxonomySpecies("orchid-0") });
    observations.push({ species: taxonomySpecies("not-orchid") });
    metadata.set("not-orchid", taxonMetadataEntry("morot", "art", "accepted", "other-family"));
    expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
      .not.toContain("hundred-orchid-species");

    const lastOrchidId = "orchid-29";
    observations.push({ species: taxonomySpecies(lastOrchidId) });
    metadata.set(
      lastOrchidId,
      taxonMetadataEntry("Orchid 29", "art", "accepted", ORCHIDACEAE_TAXON_ID),
    );
    expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
      .toContain("hundred-orchid-species");
  });

  it("counts unique accepted species with Swedish prefixes case-insensitively", () => {
    const prefixAchievements = [
      { prefix: "äng", minimum: 20, id: "meadow-prefix-expert" },
      { prefix: "skog", minimum: 20, id: "forest-prefix-expert" },
      { prefix: "strand", minimum: 20, id: "shore-prefix-expert" },
      { prefix: "fjäll", minimum: 40, id: "mountain-prefix-expert" },
    ] as const;

    for (const { prefix, minimum, id } of prefixAchievements) {
      const observations: AchievementObservation[] = [];
      const metadata = new Map<string, DyntaxaTaxonMetadata>();
      const upperPrefix = prefix.toLocaleUpperCase("sv-SE");
      const addSpecies = (index: number) => {
        const taxonId = "prefix-" + id + "-" + index;
        observations.push({ species: taxonomySpecies(taxonId) });
        metadata.set(taxonId, taxonMetadataEntry(upperPrefix + "sväxt " + index));
      };

      for (let index = 0; index < minimum - 1; index += 1) addSpecies(index);
      observations.push(observations[0]!);
      observations.push({ species: { source: "free-text", enteredName: prefix + " fritext" } });
      const subspeciesId = "subspecies-" + id;
      observations.push({ species: taxonomySpecies(subspeciesId) });
      metadata.set(subspeciesId, taxonMetadataEntry(upperPrefix + "underart", "underart"));
      expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
        .not.toContain(id);

      addSpecies(minimum - 1);
      expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
        .toContain(id);
      addSpecies(minimum);
      expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
        .toContain(id);
    }

    const wrongAccentObservations: AchievementObservation[] = [];
    const wrongAccentMetadata = new Map<string, DyntaxaTaxonMetadata>();
    for (let index = 0; index < 20; index += 1) {
      const taxonId = "unaccented-meadow-" + index;
      wrongAccentObservations.push({ species: taxonomySpecies(taxonId) });
      wrongAccentMetadata.set(taxonId, taxonMetadataEntry("Angsväxt " + index));
    }
    expect(findNewlyEligibleAchievements(
      wrongAccentObservations, new Set(), packageId, wrongAccentMetadata,
    )).not.toContain("meadow-prefix-expert");
  });

  it("counts 1,000 unique species at, below, and above its threshold", () => {
    const observations: AchievementObservation[] = [];
    const metadata = new Map<string, DyntaxaTaxonMetadata>();
    for (let index = 0; index < 999; index += 1) {
      const taxonId = "unique-" + index;
      observations.push({ species: taxonomySpecies(taxonId) });
      metadata.set(taxonId, taxonMetadataEntry("Art " + index));
    }
    observations.push({ species: taxonomySpecies("unique-0") });
    expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
      .not.toContain("thousand-unique-species");

    for (let index = 999; index < 1001; index += 1) {
      const taxonId = "unique-" + index;
      observations.push({ species: taxonomySpecies(taxonId) });
      metadata.set(taxonId, taxonMetadataEntry("Art " + index));
    }
    expect(findNewlyEligibleAchievements(observations, new Set(), packageId, metadata))
      .toContain("thousand-unique-species");
  });

  it("counts all observations including free text at the 1,000 and 10,000 boundaries", () => {
    const thousand = Array.from({ length: 1000 }, (_, index) => ({
      species: { source: "free-text" as const, enteredName: "Okänd " + index },
    }));
    expect(
      findNewlyEligibleAchievements(thousand.slice(0, 999), new Set(), packageId, new Map()),
    ).toEqual([]);
    expect(findNewlyEligibleAchievements(thousand, new Set(), packageId, new Map()))
      .toEqual(["thousand-observations"]);
    thousand.push({ species: { source: "free-text", enteredName: "Extra" } });
    expect(findNewlyEligibleAchievements(thousand, new Set(), packageId, new Map()))
      .toContain("thousand-observations");
    expect(findNewlyEligibleAchievements(
      thousand,
      new Set(["thousand-observations"]),
      packageId,
      new Map(),
    )).toEqual([]);

    const tenThousand = Array.from({ length: 9999 }, (_, index) => ({
      species: { source: "free-text" as const, enteredName: "Okänd " + index },
    }));
    expect(findNewlyEligibleAchievements(tenThousand, new Set(), packageId, new Map()))
      .not.toContain("ten-thousand-observations");
    tenThousand.push({ species: { source: "free-text", enteredName: "Den tionde tusende" } });
    expect(findNewlyEligibleAchievements(tenThousand, new Set(), packageId, new Map()))
      .toContain("ten-thousand-observations");
    tenThousand.push({ species: { source: "free-text", enteredName: "Ännu en" } });
    expect(findNewlyEligibleAchievements(tenThousand, new Set(), packageId, new Map()))
      .toContain("ten-thousand-observations");
  });

  it("requires accepted species rank and the selected Dyntaxa package", () => {
    const morot = taxonomySpecies(MOROT_TAXON_ID);
    expect(findNewlyEligibleAchievements(
      [{ species: morot }],
      new Set(),
      packageId,
      taxonMetadata([MOROT_TAXON_ID], "art", "not-accepted"),
    )).toEqual([]);
    expect(findNewlyEligibleAchievements(
      [{ species: { ...morot, taxonomyPackageId: "other-package" } }],
      new Set(),
      packageId,
      taxonMetadata([MOROT_TAXON_ID]),
    )).toEqual([]);
  });
});
