import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import type { ObservationDraft, Survey, SurveyLocale, Taxon } from "@/domain/models";
import { buildObservationInput, speciesSnapshotForSelection } from "../observationFormData";

const survey: Survey = {
  id: "survey-1",
  title: "Inventering",
  surveyDate: "2026-10-12",
  status: "active",
  taxonomyRef: VASCULAR_PLANTS_TAXONOMY,
  createdAt: "2026-10-12T07:00:00.000Z",
  updatedAt: "2026-10-12T07:00:00.000Z",
};

const locale: SurveyLocale = {
  id: "locale-1",
  surveyId: survey.id,
  name: "Lillåsen",
  observedAt: "2026-10-12T09:00:00+02:00",
  timeZone: "Europe/Stockholm",
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6_400_000, easting: 1_300_000, crs: "EPSG:3847" },
    source: "manual-rt90",
  },
  useLocaleTimeByDefault: false,
  useLocalePositionByDefault: false,
  createdAt: "2026-10-12T07:00:00.000Z",
  updatedAt: "2026-10-12T07:00:00.000Z",
};

function draft(): ObservationDraft {
  return {
    date: "2026-10-12",
    time: "09:00",
    timeOverridden: false,
    northing: "6400000",
    easting: "1300000",
    accuracyMeters: "4,5",
    positionSource: "manual-rt90",
    positionOverridden: false,
    speciesQuery: "  Okänd ört  ",
    amount: "2,5",
    unit: "m2",
    publicComment: "  Kommentar  ",
    additionalObservers: "Anna; Bo",
    addToSpeciesList: false,
  };
}

describe("observation form data", () => {
  it("builds a trimmed free-text observation with parsed form values", () => {
    const input = buildObservationInput(survey, locale, draft());

    expect(input).toMatchObject({
      surveyId: survey.id,
      localeId: locale.id,
      localityName: locale.name,
      timeZone: locale.timeZone,
      species: { source: "free-text", enteredName: "Okänd ört" },
      amount: { value: 2.5, unit: "m2" },
      publicComment: "Kommentar",
      additionalObservers: ["Anna", "Bo"],
      position: { rt90: { northing: 6_400_000, easting: 1_300_000 }, accuracyMeters: 4.5 },
    });
  });

  it("stores the selected taxonomy identity and the entered-name snapshot", () => {
    const taxon: Taxon = {
      id: "taxon-1",
      source: "taxonomy",
      preferredName: "Ängsvädd",
      scientificName: "Succisa pratensis",
      synonyms: [],
      rank: "species",
      status: "accepted",
    };

    expect(speciesSnapshotForSelection("ängsvädd i fält", taxon, survey)).toEqual({
      source: "taxonomy",
      enteredName: "ängsvädd i fält",
      taxonId: taxon.id,
      preferredName: taxon.preferredName,
      scientificName: taxon.scientificName,
      taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
      taxonomyVersion: VASCULAR_PLANTS_TAXONOMY.version,
    });
  });
});
