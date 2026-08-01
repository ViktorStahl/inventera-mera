import type { TaxonomyReference } from "@/domain/models";

export type AvailableTaxonomy = TaxonomyReference & {
  description: string;
  downloaded: boolean;
};

export const VASCULAR_PLANTS_TAXONOMY: AvailableTaxonomy = {
  packageId: "vascular-plants-starter",
  name: "Kärlväxter (Dyntaxa)",
  version: "2026-07-mvp",
  description: "Begränsat offline-startpaket för kärlväxtflödet; fullständigt Dyntaxa-paket återstår.",
  downloaded: true,
};

export const AVAILABLE_TAXONOMIES: AvailableTaxonomy[] = [VASCULAR_PLANTS_TAXONOMY];

export function findTaxonomy(packageId: string): AvailableTaxonomy | undefined {
  return AVAILABLE_TAXONOMIES.find((taxonomy) => taxonomy.packageId === packageId);
}
