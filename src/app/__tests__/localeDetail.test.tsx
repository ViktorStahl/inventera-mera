import { render, waitFor } from "@testing-library/react-native";

import type { Observation, Survey, SurveyLocale } from "@/domain/models";
import { getLocale, getSurvey, listLocaleObservations } from "@/storage/database";
import LocaleDetailScreen from "../surveys/[surveyId]/locales/[localeId]";

const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    Stack: { Screen: () => null },
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useLocalSearchParams: () => ({ surveyId: "survey-1", localeId: "locale-1" }),
    useRouter: () => ({ push: mockPush }),
  };
});
jest.mock("@/storage/database", () => ({
  getLocale: jest.fn(),
  getSurvey: jest.fn(),
  listLocaleObservations: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const survey: Survey = {
  id: "survey-1",
  title: "Ängsinventering",
  surveyDate: "2026-10-12",
  status: "active",
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

const observations: Observation[] = [
  {
    id: "uncertain-observation",
    surveyId: survey.id,
    localeId: locale.id,
    observedAt: locale.observedAt,
    timeZone: locale.timeZone,
    localityName: locale.name,
    position: locale.position,
    timeOverridden: false,
    positionOverridden: false,
    identificationUncertain: true,
    species: { source: "free-text", enteredName: "Okänd ört" },
    additionalObservers: [],
    createdAt: "2026-10-12T07:00:00.000Z",
    updatedAt: "2026-10-12T07:00:00.000Z",
  },
  {
    id: "certain-observation",
    surveyId: survey.id,
    localeId: locale.id,
    observedAt: locale.observedAt,
    timeZone: locale.timeZone,
    localityName: locale.name,
    position: locale.position,
    timeOverridden: false,
    positionOverridden: false,
    identificationUncertain: false,
    species: { source: "free-text", enteredName: "Blåbär" },
    additionalObservers: [],
    createdAt: "2026-10-12T07:00:00.000Z",
    updatedAt: "2026-10-12T07:00:00.000Z",
  },
];

describe("locale observation list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSurvey).mockResolvedValue(survey);
    jest.mocked(getLocale).mockResolvedValue(locale);
    jest.mocked(listLocaleObservations).mockResolvedValue(observations);
  });

  it("marks uncertain identifications and includes the state in accessibility text", async () => {
    const screen = render(<LocaleDetailScreen />);

    await waitFor(() => expect(listLocaleObservations).toHaveBeenCalledWith(locale.id));
    expect(await screen.findByText("Osäker")).toBeTruthy();
    expect(screen.getAllByText("Osäker")).toHaveLength(1);
    expect(screen.getByText("Okänd ört")).toBeTruthy();
    expect(screen.getByLabelText("Redigera Okänd ört, osäker artbestämning")).toBeTruthy();
    expect(screen.getByLabelText("Redigera Blåbär")).toBeTruthy();
  });
});
