import { speciesKey } from "./species";
import type { SpeciesSnapshot } from "./models";
export const ORCHIDACEAE_TAXON_ID = "urn:lsid:dyntaxa.se:Taxon:2002692";

export const MOROT_TAXON_ID = "urn:lsid:dyntaxa.se:Taxon:219664";

type AchievementCriterion =
  | { type: "observed-taxon"; taxonId: string }
  | { type: "observation-count"; minimum: number }
  | {
      type: "distinct-species";
      minimum: number;
      familyTaxonId?: string;
      preferredNamePrefix?: string;
    };

type AchievementDefinition = {
  id: string;
  title: string;
  scientificName?: string;
  description: string;
  criterion: AchievementCriterion;
};

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: "first-morot",
    title: "Observerat Daucus carota",
    scientificName: "Daucus carota",
    description: "Det är alltid bra med en morot",
    criterion: { type: "observed-taxon", taxonId: MOROT_TAXON_ID },
  },
  {
    id: "hundred-species",
    title: "100 arter",
    description:
      "Om du inte känner till namnen försvinner också din kunskap om tingen - Carl von Linné",
    criterion: { type: "distinct-species", minimum: 100 },
  },
  {
    id: "thousand-observations",
    title: "1000 observationer",
    description: "Bra jobbat!",
    criterion: { type: "observation-count", minimum: 1000 },
  },
  {
    id: "hundred-orchid-species",
    title: "Orkidéernas värld",
    description: "Du har observerat 30 olika orkidéarter. Vilken blomsterprakt!",
    criterion: {
      type: "distinct-species",
      minimum: 30,
      familyTaxonId: ORCHIDACEAE_TAXON_ID,
    },
  },

  {
    id: "meadow-prefix-expert",
    title: "Ängsexpert",
    description: "Du har observerat 20 olika arter vars svenska namn börjar med ”äng”.",
    criterion: { type: "distinct-species", minimum: 20, preferredNamePrefix: "äng" },
  },

  {
    id: "forest-prefix-expert",
    title: "Skogsexpert",
    description: "Du har observerat 20 olika arter vars svenska namn börjar med ”skog”.",
    criterion: { type: "distinct-species", minimum: 20, preferredNamePrefix: "skog" },
  },

  {
    id: "shore-prefix-expert",
    title: "Strandexpert",
    description: "Du har observerat 20 olika arter vars svenska namn börjar med ”strand”.",
    criterion: { type: "distinct-species", minimum: 20, preferredNamePrefix: "strand" },
  },

  {
    id: "mountain-prefix-expert",
    title: "Fjällexpert",
    description: "Du har observerat 40 olika arter vars svenska namn börjar med ”fjäll”.",
    criterion: { type: "distinct-species", minimum: 40, preferredNamePrefix: "fjäll" },
  },

  {
    id: "ten-thousand-observations",
    title: "10 000 observationer",
    description: "Du har registrerat 10 000 växtobservationer. Vilken insats!",
    criterion: { type: "observation-count", minimum: 10000 },
  },

  {
    id: "thousand-unique-species",
    title: "1000 arter",
    description: "Du har observerat 1 000 olika accepterade Dyntaxa-arter.",
    criterion: { type: "distinct-species", minimum: 1000 },
  },
] as const satisfies readonly AchievementDefinition[];

export type AchievementId = (typeof ACHIEVEMENT_DEFINITIONS)[number]["id"];

export type AchievementAward = {
  achievementId: AchievementId;
  achievedAt: string;
  acknowledgedAt: string | null;
};

export type AchievementObservation = {
  species: SpeciesSnapshot;
};

export type DyntaxaTaxonMetadata = {
  preferredName: string;
  rank: string;
  status: string;
  familyTaxonId: string | null;
};

export function findNewlyEligibleAchievements(
  observations: AchievementObservation[],
  unlockedIds: ReadonlySet<string>,
  taxonomyPackageId: string,
  taxonMetadata: ReadonlyMap<string, DyntaxaTaxonMetadata>,
): AchievementId[] {
  const observedTaxonIds = new Set<string>();
  const distinctSpecies = new Map<string, DyntaxaTaxonMetadata>();

  for (const observation of observations) {
    const species = observation.species;
    if (
      species.source !== "taxonomy" ||
      species.taxonomyPackageId !== taxonomyPackageId ||
      !species.taxonId
    ) continue;

    const taxon = taxonMetadata.get(species.taxonId);
    if (!taxon || taxon.status !== "accepted" || taxon.rank !== "art") continue;

    observedTaxonIds.add(species.taxonId);
    distinctSpecies.set(speciesKey(species), taxon);
  }

  const newlyEligible: AchievementId[] = [];
  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    if (unlockedIds.has(achievement.id)) continue;

    const criterionMet = isCriterionMet(
      achievement.criterion,
      observations.length,
      observedTaxonIds,
      distinctSpecies,
    );
    if (criterionMet) newlyEligible.push(achievement.id);
  }
  return newlyEligible;
}

function isCriterionMet(
  criterion: AchievementCriterion,
  observationCount: number,
  observedTaxonIds: ReadonlySet<string>,
  distinctSpecies: ReadonlyMap<string, DyntaxaTaxonMetadata>,
): boolean {
  switch (criterion.type) {
    case "observed-taxon":
      return observedTaxonIds.has(criterion.taxonId);
    case "observation-count":
      return observationCount >= criterion.minimum;
    case "distinct-species": {
      let matchingSpeciesCount = 0;
      for (const taxon of distinctSpecies.values()) {
        if (criterion.familyTaxonId && taxon.familyTaxonId !== criterion.familyTaxonId) continue;
        if (
          criterion.preferredNamePrefix &&
          !taxon.preferredName.toLocaleLowerCase("sv-SE").startsWith(
            criterion.preferredNamePrefix.toLocaleLowerCase("sv-SE"),
          )
        ) continue;
        matchingSpeciesCount += 1;
      }
      return matchingSpeciesCount >= criterion.minimum;
    }
  }
  return false;
}

export function sortAchievementAwards(awards: AchievementAward[]): AchievementAward[] {
  const definitionOrder = new Map(
    ACHIEVEMENT_DEFINITIONS.map((achievement, index) => [achievement.id, index]),
  );
  return [...awards].sort(
    (left, right) =>
      left.achievedAt.localeCompare(right.achievedAt) ||
      (definitionOrder.get(left.achievementId) ?? 0) -
        (definitionOrder.get(right.achievementId) ?? 0),
  );
}
