import { fireEvent, waitFor, render } from "@testing-library/react-native";

import type { StatisticsSummary } from "@/domain/statistics";
import type { AchievementAward } from "@/domain/achievements";
import { getStatisticsSummary } from "@/storage/database";
import { confirmDestructive } from "@/ui/confirm";
import StatisticsScreen from "../statistics";

jest.mock("expo-router", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    Stack: { Screen: () => null },
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock("@/storage/database", () => ({
  getStatisticsSummary: jest.fn(),
}));

const mockAwards: AchievementAward[] = [];
const mockReset = jest.fn();

jest.mock("@/features/achievements/AchievementProvider", () => {
  const actual = jest.requireActual("@/features/achievements/AchievementProvider") as typeof import("@/features/achievements/AchievementProvider");
  return {
    ...actual,
    useAchievements: () => ({ awards: mockAwards, reset: mockReset }),
    AchievementIcon: () => null,
    formatAchievementDate: () => "11 oktober 2026",
  };
});
jest.mock("@/ui/confirm", () => ({ confirmDestructive: jest.fn() }));

const now = new Date();
const currentMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

const summary: StatisticsSummary = {
  surveyCount: 2,
  totalObservations: 6,
  averageObservationsPerSurvey: 3,
  observationsByMonth: [{ month: currentMonth, observationCount: 6 }],
  topSpecies: [
    { speciesKey: "taxonomy:test:1", name: "Alm", observationCount: 4 },
    { speciesKey: "taxonomy:test:2", name: "Blåbär", observationCount: 2 },
  ],
};

describe("statistics screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAwards.splice(0);
    mockReset.mockResolvedValue(undefined);
    jest.mocked(confirmDestructive).mockResolvedValue(true);
  });

  it("loads aggregate statistics on focus without rendering survey or locale breakdowns", async () => {
    jest.mocked(getStatisticsSummary).mockResolvedValue(summary);

    const screen = render(<StatisticsScreen />);

    await waitFor(() => expect(getStatisticsSummary).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Totalt antal observationer")).toBeTruthy();
    expect(screen.getByText("Genomsnittliga observationer per inventering")).toBeTruthy();
    expect(screen.getByText("Observationer per månad")).toBeTruthy();
    expect(screen.getByText("Senaste 12 månaderna")).toBeTruthy();
    expect(screen.getAllByRole("image")).toHaveLength(12);
    expect(screen.getByText("Topp 3 arter")).toBeTruthy();
    expect(screen.getByText("Alm")).toBeTruthy();
    expect(screen.getByText("Blåbär")).toBeTruthy();
    expect(screen.queryByText("Inventering 1")).toBeNull();
    expect(screen.queryByText("Lokal 1")).toBeNull();
  });

  it("shows an empty state and no average when no surveys exist", async () => {
    jest.mocked(getStatisticsSummary).mockResolvedValue({
      surveyCount: 0,
      totalObservations: 0,
      averageObservationsPerSurvey: null,
      observationsByMonth: [],
      topSpecies: [],
    });

    const screen = render(<StatisticsScreen />);

    expect(await screen.findByText("Ingen statistik ännu")).toBeTruthy();
    expect(screen.getByText("Genomsnittliga observationer per inventering")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });
  it("renders achievement tiles and resets after confirmation", async () => {
    mockAwards.push({
      achievementId: "first-morot",
      achievedAt: "2026-10-11T12:00:00.000Z",
      acknowledgedAt: null,
    });
    jest.mocked(getStatisticsSummary).mockResolvedValue(summary);

    const screen = render(<StatisticsScreen />);

    expect(await screen.findByText("Prestationer")).toBeTruthy();
    expect(screen.getByText("Observerat Daucus carota")).toBeTruthy();
    expect(screen.getByText("Det är alltid bra med en morot")).toBeTruthy();
    expect(screen.getByText("Uppnådd 11 oktober 2026")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Återställ prestationer" }));
    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled());
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
  });
});
