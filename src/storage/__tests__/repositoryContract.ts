import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import {
  freshLocaleInput,
  freshObservationInput,
  freshSurveyDraft,
  type ContractRepository,
} from "./repositoryTestFixtures";

export function registerRepositoryContract(
  adapterName: string,
  createRepository: () => Promise<ContractRepository> | ContractRepository,
): void {
  describe(`${adapterName} repository contract`, () => {
    it("keeps inherited fields live while preserving explicit overrides", async () => {
      const repository = await createRepository();
      const survey = await repository.createSurvey(freshSurveyDraft());
      const localeInput = freshLocaleInput(survey.id);
      const locale = await repository.createLocale(localeInput);
      const inherited = await repository.createObservation(
        freshObservationInput(survey.id, locale),
      );
      const override = await repository.createObservation(
        freshObservationInput(survey.id, locale, {
          observedAt: "2026-10-12T10:30:00+02:00",
          timeOverridden: true,
          position: {
            ...locale.position,
            rt90: { ...locale.position.rt90, northing: 6_400_250 },
          },
          positionOverridden: true,
        }),
      );

      const updatedLocale = await repository.updateLocale(locale.id, {
        ...localeInput,
        name: "Lillåsen västra",
        observedAt: "2026-10-13T08:00:00+02:00",
        position: {
          ...locale.position,
          rt90: { ...locale.position.rt90, northing: 6_400_100 },
        },
      });
      const observations = await repository.listLocaleObservations(locale.id);

      expect(observations.find((item) => item.id === inherited.id)).toMatchObject({
        localityName: updatedLocale.name,
        observedAt: updatedLocale.observedAt,
        position: { rt90: { northing: 6_400_100 } },
      });
      expect(observations.find((item) => item.id === override.id)).toMatchObject({
        localityName: updatedLocale.name,
        observedAt: "2026-10-12T10:30:00+02:00",
        position: { rt90: { northing: 6_400_250 } },
      });
    });

    it("adds a free-text observation to its survey list and round-trips a v5 backup", async () => {
      const repository = await createRepository();
      const speciesList = await repository.createSpeciesList(
        "Fältlista",
        VASCULAR_PLANTS_TAXONOMY,
      );
      const survey = await repository.createSurvey({
        ...freshSurveyDraft(),
        speciesListId: speciesList.id,
      });
      const locale = await repository.createLocale(freshLocaleInput(survey.id));
      const observation = await repository.createObservation(
        freshObservationInput(survey.id, locale, {
          species: { source: "free-text", enteredName: "Okänd fältväxt" },
        }),
        speciesList.id,
      );

      expect(await repository.speciesListContains(speciesList.id, observation.species)).toBe(true);
      const backup = await repository.buildSurveyBackup(survey.id);
      expect(backup.formatVersion).toBe(5);
      expect(await repository.restoreSurveyBackup(backup)).toBe(survey.id);
      expect(await repository.listLocales(survey.id)).toHaveLength(1);
      expect(await repository.listObservations(survey.id)).toMatchObject([
        { id: observation.id, species: { enteredName: "Okänd fältväxt" } },
      ]);
      expect(await repository.getSurvey(survey.id)).toMatchObject({
        speciesListId: speciesList.id,
      });
      expect(await repository.speciesListContains(speciesList.id, observation.species)).toBe(true);
    });

    it("blocks writes to archived surveys until restored", async () => {
      const repository = await createRepository();
      const survey = await repository.createSurvey(freshSurveyDraft());
      const localeInput = freshLocaleInput(survey.id);
      const locale = await repository.createLocale(localeInput);

      await expect(repository.deleteSurvey(survey.id)).rejects.toThrow("Arkivera inventeringen");
      await repository.archiveSurvey(survey.id);
      await expect(repository.createLocale(localeInput)).rejects.toThrow("arkiverad");
      await expect(repository.deleteLocale(survey.id, locale.id)).rejects.toThrow("arkiverad");

      await repository.restoreSurvey(survey.id);
      await repository.createLocale({ ...localeInput, name: "Ny lokal" });
      await repository.archiveSurvey(survey.id);
      await repository.deleteSurvey(survey.id);
      expect(await repository.getSurvey(survey.id)).toBeNull();
    });
  });
}
