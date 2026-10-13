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

    it("round-trips v6 uncertainty and defaults missing v5 values to false", async () => {
      const repository = await createRepository();
      const speciesList = await repository.createSpeciesList(
        "Fältlista",
        VASCULAR_PLANTS_TAXONOMY,
      );
      const survey = await repository.createSurvey({
        ...freshSurveyDraft(),
        speciesListId: speciesList.id,
      });
      const locale = await repository.createLocale({
        ...freshLocaleInput(survey.id),
        useLocaleTimeByDefault: true,
      });
      const observation = await repository.createObservation(
        freshObservationInput(survey.id, locale, {
          species: { source: "free-text", enteredName: "Okänd fältväxt" },
          identificationUncertain: true,
        }),
        speciesList.id,
      );

      expect(await repository.speciesListContains(speciesList.id, observation.species)).toBe(true);
      const backup = await repository.buildSurveyBackup(survey.id);
      expect(backup.formatVersion).toBe(6);
      expect(await repository.restoreSurveyBackup(backup)).toBe(survey.id);
      expect(await repository.listLocales(survey.id)).toEqual([
        expect.objectContaining({
          useLocaleTimeByDefault: true,
          useLocalePositionByDefault: false,
        }),
      ]);
      expect(await repository.listObservations(survey.id)).toMatchObject([
        {
          id: observation.id,
          species: { enteredName: "Okänd fältväxt" },
          identificationUncertain: true,
        },
      ]);

      const legacyBackup = {
        ...backup,
        formatVersion: 5,
        observations: backup.observations.map(({ identificationUncertain: _, ...item }) => item),
      };
      await repository.restoreSurveyBackup(legacyBackup);
      expect(await repository.listObservations(survey.id)).toMatchObject([
        { id: observation.id, identificationUncertain: false },
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
      await repository.createObservation(freshObservationInput(survey.id, locale));

      await expect(repository.deleteSurvey(survey.id)).rejects.toThrow("Arkivera inventeringen");
      await repository.archiveSurvey(survey.id);
      await expect(repository.createLocale(localeInput)).rejects.toThrow("arkiverad");
      await expect(repository.deleteLocale(survey.id, locale.id)).rejects.toThrow("arkiverad");

      await repository.restoreSurvey(survey.id);
      await repository.createLocale({ ...localeInput, name: "Ny lokal" });
      await repository.archiveSurvey(survey.id);
      expect((await repository.getStatisticsSummary()).totalObservations).toBe(1);
      await repository.deleteSurvey(survey.id);
      expect(await repository.getSurvey(survey.id)).toBeNull();
      expect((await repository.getStatisticsSummary()).totalObservations).toBe(0);
    });

    it("updates and deletes observations and reflects the changes in statistics", async () => {
      const repository = await createRepository();
      const survey = await repository.createSurvey(freshSurveyDraft());
      const locale = await repository.createLocale(freshLocaleInput(survey.id));
      const observation = await repository.createObservation(
        freshObservationInput(survey.id, locale),
      );

      const updated = await repository.updateObservation(
        observation.id,
        freshObservationInput(survey.id, locale, {
          identificationUncertain: true,
          species: { source: "free-text", enteredName: "Klockljung" },
          amount: { value: 4, unit: "plantor/tuvor" },
        }),
      );
      expect(updated).toMatchObject({
        identificationUncertain: true,
        species: { enteredName: "Klockljung" },
        amount: { value: 4, unit: "plantor/tuvor" },
      });
      expect(await repository.getStatisticsSummary()).toMatchObject({
        totalObservations: 1,
        topSpecies: [expect.objectContaining({ name: "Klockljung", observationCount: 1 })],
      });

      await repository.deleteObservation(survey.id, observation.id);
      expect(await repository.listLocaleObservations(locale.id)).toEqual([]);
      expect((await repository.getStatisticsSummary()).totalObservations).toBe(0);
    });

    it("stores and removes drafts", async () => {
      const repository = await createRepository();
      const key = "survey:edit:survey-1";

      await repository.saveDraft(key, { title: "Pågående ändring" });
      expect(await repository.loadDraft(key)).toEqual({ title: "Pågående ändring" });

      await repository.deleteDraft(key);
      expect(await repository.loadDraft(key)).toBeNull();
    });

    it("deduplicates and removes species-list entries", async () => {
      const repository = await createRepository();
      const list = await repository.createSpeciesList("Fältlista", VASCULAR_PLANTS_TAXONOMY);
      const species = { source: "free-text" as const, enteredName: "Okänd ört" };

      const first = await repository.addSpeciesToList(list.id, species);
      const duplicate = await repository.addSpeciesToList(list.id, {
        ...species,
        enteredName: "  OKÄND ÖRT  ",
      });
      expect(duplicate.id).toBe(first.id);
      expect(await repository.listSpeciesListEntries(list.id)).toHaveLength(1);

      await repository.removeSpeciesFromList(list.id, first.id);
      expect(await repository.listSpeciesListEntries(list.id)).toEqual([]);
    });
  });
}
