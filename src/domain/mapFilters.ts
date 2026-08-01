import type { Observation } from "./models";

export type ObservationMapFilters = {
  localeIds: string[];
  speciesKeys: string[];
  date?: string;
};

export type SpeciesFilterOption = {
  key: string;
  name: string;
  scientificName?: string;
  count: number;
};

export function speciesFilterKey(observation: Observation): string {
  if (observation.species.source === "taxonomy" && observation.species.taxonId) {
    return [
      "taxonomy",
      observation.species.taxonomyPackageId ?? "",
      observation.species.taxonomyVersion ?? "",
      observation.species.taxonId,
    ].join(":");
  }
  return `free-text:${normalize(observation.species.enteredName)}`;
}

export function listSpeciesFilterOptions(
  observations: Observation[],
): SpeciesFilterOption[] {
  const options = new Map<string, SpeciesFilterOption>();
  for (const observation of observations) {
    const key = speciesFilterKey(observation);
    const existing = options.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    options.set(key, {
      key,
      name: observation.species.preferredName ?? observation.species.enteredName,
      scientificName: observation.species.scientificName,
      count: 1,
    });
  }
  return [...options.values()].sort((left, right) => left.name.localeCompare(right.name, "sv"));
}

export function filterMapObservations(
  observations: Observation[],
  filters: ObservationMapFilters,
): Observation[] {
  const localeIds = new Set(filters.localeIds);
  const speciesKeys = new Set(filters.speciesKeys);
  return observations.filter((observation) => {
    if (localeIds.size > 0 && !localeIds.has(observation.localeId)) return false;
    if (speciesKeys.size > 0 && !speciesKeys.has(speciesFilterKey(observation))) return false;
    if (filters.date && !observation.observedAt.startsWith(`${filters.date}T`)) return false;
    return true;
  });
}

function normalize(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv");
}
