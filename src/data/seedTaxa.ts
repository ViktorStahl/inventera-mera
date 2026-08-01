import type { Taxon } from "@/domain/models";

// A deliberately small offline starter list for validating the field workflow.
// IDs are local and must not be confused with Dyntaxa taxon IDs. The production
// Dyntaxa package replaces this list through the taxonomy package pipeline.
export const SEED_TAXA: Taxon[] = [
  ["Ängsvädd", "Succisa pratensis", ["Blåknapp"], "art"],
  ["Liten ängsvädd", "Succisa pratensis subsp. minor", [], "underart"],
  ["Jungfru Marie nycklar", "Dactylorhiza maculata", [], "art"],
  ["Blodrot", "Potentilla erecta", ["Tormentil"], "art"],
  ["Kärrknipprot", "Epipactis palustris", [], "art"],
  ["Ängsviol", "Viola canina subsp. montana", [], "underart"],
  ["Ängssyra", "Rumex acetosa", [], "art"],
  ["Ängskovall", "Melampyrum pratense", [], "art"],
  ["Gullviva", "Primula veris", [], "art"],
  ["Slåttergubbe", "Arnica montana", [], "art"],
  ["Brudbröd", "Filipendula vulgaris", [], "art"],
  ["Darrgräs", "Briza media", [], "art"],
  ["Jungfrulin", "Polygala vulgaris", [], "art"],
  ["Kattfot", "Antennaria dioica", [], "art"],
  ["Backtimjan", "Thymus serpyllum", [], "art"],
  ["Prästkrage", "Leucanthemum vulgare", [], "art"],
  ["Blåklocka", "Campanula rotundifolia", [], "art"],
  ["Smörboll", "Trollius europaeus", [], "art"],
  ["Ormrot", "Bistorta vivipara", ["Polygonum viviparum"], "art"],
  ["Hirsstarr", "Carex panicea", [], "art"],
  ["Ängsnycklar", "Dactylorhiza incarnata subsp. incarnata", [], "underart"],
  ["Nattviol", "Platanthera bifolia", [], "art"],
  ["Grönvit nattviol", "Platanthera chlorantha", [], "art"],
  ["Majviva", "Primula farinosa", [], "art"],
  ["Tätört", "Pinguicula vulgaris", [], "art"],
].map(([preferredName, scientificName, synonyms, rank], index) => ({
  id: `seed-${index + 1}`,
  preferredName: preferredName as string,
  scientificName: scientificName as string,
  synonyms: synonyms as string[],
  rank: rank as string,
  status: "startlista",
}));
