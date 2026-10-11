import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { listSurveys } from "@/storage/database";
import SurveyListScreen from "../surveys";

const mockPush = jest.fn();

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

describe("survey list navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(listSurveys).mockResolvedValue([]);
  });

  it("opens statistics from the secondary action group", async () => {
    const screen = render(<SurveyListScreen />);

    await waitFor(() => expect(listSurveys).toHaveBeenCalled());
    fireEvent.press(screen.getByRole("button", { name: "Statistik" }));

    expect(mockPush).toHaveBeenCalledWith("/statistics");
  });
});
