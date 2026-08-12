import type { ObservationAmount, ObservationUnit } from "./amount";

export type SurveyStatus = "active" | "archived";

export type TaxonomyReference = {
  packageId: string;
  name: string;
  version: string;
};

export type Survey = {
  id: string;
  title: string;
  description?: string;
  taxonomyRef?: TaxonomyReference;
  speciesListId?: string;
  surveyDate: string;
  status: SurveyStatus;
  createdAt: string;
  updatedAt: string;
};

export type SurveyLocale = {
  id: string;
  surveyId: string;
  name: string;
  observedAt: string;
  timeZone: string;
  position: Position;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type SpeciesSnapshot = {
  source: "taxonomy" | "free-text";
  enteredName: string;
  taxonId?: string;
  preferredName?: string;
  scientificName?: string;
  taxonomyPackageId?: string;
  taxonomyVersion?: string;
};

export type Position = {
  wgs84: { latitude: number; longitude: number };
  rt90: { northing: number; easting: number; crs: "EPSG:3847" };
  accuracyMeters?: number;
  source: "device" | "manual-rt90" | "map";
};

export type Observation = {
  id: string;
  surveyId: string;
  localeId: string;
  observedAt: string;
  timeZone: string;
  localityName: string;
  position: Position;
  timeOverridden: boolean;
  positionOverridden: boolean;
  species: SpeciesSnapshot;
  amount?: ObservationAmount;
  publicComment?: string;
  additionalObservers: string[];
  createdAt: string;
  updatedAt: string;
};

export type SurveyListItem = Survey & { localeCount: number; observationCount: number };

export type LocaleListItem = SurveyLocale & { observationCount: number };

export type Taxon = {
  id: string;
  source?: "taxonomy" | "free-text";
  preferredName: string;
  scientificName: string;
  synonyms: string[];
  rank: string;
  status: string;
  inSpeciesList?: boolean;
  speciesListEntryId?: string;
  taxonomyPackageId?: string;
  taxonomyVersion?: string;
};

export type SpeciesList = {
  id: string;
  name: string;
  taxonomyRef: TaxonomyReference;
  createdAt: string;
  updatedAt: string;
};

export type SpeciesListEntry = {
  id: string;
  speciesListId: string;
  speciesKey: string;
  species: SpeciesSnapshot;
  createdAt: string;
};

export type SpeciesListSummary = SpeciesList & { speciesCount: number };

export type AppSettings = {
  defaultTaxonomyPackageId: string;
};

export type SurveyDraft = {
  title: string;
  description: string;
  surveyDate: string;
  taxonomyPackageId: string;
  speciesListId: string;
};

export type LocaleDraft = {
  name: string;
  date: string;
  time: string;
  northing: string;
  easting: string;
  accuracyMeters: string;
  positionSource: Position["source"];
  latitude?: number;
  longitude?: number;
  note: string;
};

export type ObservationDraft = {
  date: string;
  time: string;
  timeOverridden: boolean;
  northing: string;
  easting: string;
  accuracyMeters: string;
  positionSource: Position["source"];
  positionOverridden: boolean;
  latitude?: number;
  longitude?: number;
  speciesQuery: string;
  selectedTaxon?: Taxon;
  amount: string;
  unit: ObservationUnit | "";
  publicComment: string;
  additionalObservers: string;
  addToSpeciesList: boolean;
};

export type SurveyBackup = {
  format: "inventera-mera-backup";
  formatVersion: 4;
  exportedAt: string;
  survey: Survey;
  locales: SurveyLocale[];
  observations: Observation[];
  speciesList?: {
    list: SpeciesList;
    entries: SpeciesListEntry[];
  };
};
