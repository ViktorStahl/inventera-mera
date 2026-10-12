import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { AchievementAward } from "@/domain/achievements";
import { listSurveys } from "@/storage/database";
import SurveyListScreen from "../surveys";

const mockPush = jest.fn();
const mockUseAchievements = jest.fn();

jest.mock("expo-router", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    Stack: { Screen: () => null },
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useRouter: () => ({ push: mockPush }),
  };
});
jest.mock("@/storage/database", () => ({
  listSurveys: jest.fn(),
  restoreSurveyBackup: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/ui/ConnectionBadge", () => ({ ConnectionBadge: () => null }));

jest.mock("@/features/achievements/AchievementProvider", () => ({
  useAchievements: () => mockUseAchievements(),
}));
describe("survey list navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(listSurveys).mockResolvedValue([]);
    mockUseAchievements.mockReturnValue({
      awards: [{
        achievementId: "first-morot",
        achievedAt: "2026-10-11T12:00:00.000Z",
        acknowledgedAt: null,
      } satisfies AchievementAward],
    });
  });

  it("opens statistics from the secondary action group", async () => {
    const screen = render(<SurveyListScreen />);

    await waitFor(() => expect(listSurveys).toHaveBeenCalled());
    fireEvent.press(screen.getByRole("button", { name: "Statistik" }));

    expect(mockPush).toHaveBeenCalledWith("/statistics");
  });
  it("hides Statistics before the first achievement is unlocked", async () => {
    mockUseAchievements.mockReturnValue({ awards: [] });
    const screen = render(<SurveyListScreen />);
    await waitFor(() => expect(listSurveys).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Statistik" })).toBeNull();
  });
});
