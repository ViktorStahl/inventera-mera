import type { SurveyDraft } from "@/domain/models";
import type { ValidationErrors } from "@/domain/validation";
import { TaxonomySpeciesListFields } from "@/features/taxonomy/TaxonomySpeciesListFields";
import { Field } from "@/ui/Field";

export function SurveyFields({
  draft,
  errors,
  onUpdate,
}: {
  draft: SurveyDraft;
  errors: ValidationErrors<SurveyDraft>;
  onUpdate: <K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) => void;
}) {
  return (
    <>
      <Field
        label="Titel"
        value={draft.title}
        onChangeText={(value) => onUpdate("title", value)}
        placeholder="Till exempel Ängsmark vid Lillåsen"
        error={errors.title}
        autoFocus
      />
      <Field
        label="Beskrivning (valfri)"
        value={draft.description}
        onChangeText={(value) => onUpdate("description", value)}
        placeholder="Syfte eller avgränsning"
        multiline
      />
      <Field
        label="Inventeringsdatum"
        value={draft.surveyDate}
        onChangeText={(value) => onUpdate("surveyDate", value)}
        placeholder="ÅÅÅÅ-MM-DD"
        keyboardType="numbers-and-punctuation"
        error={errors.surveyDate}
      />
      <TaxonomySpeciesListFields
        taxonomyPackageId={draft.taxonomyPackageId}
        speciesListId={draft.speciesListId}
        onTaxonomyChange={(value) => onUpdate("taxonomyPackageId", value)}
        onSpeciesListChange={(value) => onUpdate("speciesListId", value)}
        taxonomyError={errors.taxonomyPackageId}
      />
    </>
  );
}
