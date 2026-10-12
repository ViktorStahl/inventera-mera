import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import type { AchievementAward, AchievementId } from "@/domain/achievements";
import { AchievementProvider } from "../AchievementProvider";

const mockAwards: AchievementAward[] = [];
const mockEvaluate = jest.fn();
const mockListAwards = jest.fn();
const mockAcknowledge = jest.fn();
const mockReset = jest.fn();

jest.mock("@/storage/database", () => ({
  evaluateAchievements: (...args: unknown[]) => mockEvaluate(...args),
  listAchievementAwards: (...args: unknown[]) => mockListAwards(...args),
  acknowledgeAchievement: (achievementId: AchievementId) => mockAcknowledge(achievementId),
  resetAchievements: (...args: unknown[]) => mockReset(...args),
}));

describe("AchievementProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAwards.splice(0);
    mockEvaluate.mockResolvedValue([]);
    mockListAwards.mockImplementation(async () => mockAwards.map((award) => ({ ...award })));
    mockAcknowledge.mockImplementation(async (achievementId: AchievementId) => {
      const award = mockAwards.find((item) => item.achievementId === achievementId);
      if (award) award.acknowledgedAt = "2026-10-11T12:01:00.000Z";
    });
    mockReset.mockResolvedValue(undefined);
  });

  it("checks on startup and presents pending achievements one at a time", async () => {
    const achievedAt = "2026-10-11T12:00:00.000Z";
    mockAwards.push(
      { achievementId: "first-morot", achievedAt, acknowledgedAt: null },
      { achievementId: "hundred-species", achievedAt, acknowledgedAt: null },
      { achievementId: "thousand-observations", achievedAt, acknowledgedAt: null },
    );

    const screen = render(
      <AchievementProvider>
        <Text>App</Text>
      </AchievementProvider>,
    );

    await waitFor(() => expect(mockEvaluate).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Observerat Daucus carota")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Härligt!" }));

    expect(await screen.findByText("100 arter")).toBeTruthy();
    expect(screen.queryByText("Observerat Daucus carota")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Härligt!" }));

    expect(await screen.findByText("1000 observationer")).toBeTruthy();
    expect(mockAcknowledge).toHaveBeenCalledTimes(2);
  });
});
