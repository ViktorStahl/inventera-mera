import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { saveDraft } from "../database";
import { useDraftAutosave } from "../useDraftAutosave";

jest.mock("../database", () => ({
  saveDraft: jest.fn(() => Promise.resolve()),
}));

const mockedSaveDraft = jest.mocked(saveDraft);

describe("useDraftAutosave", () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockedSaveDraft.mockClear();
    remove.mockClear();
    appStateListener = undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("debounces changes and saves the newest draft", () => {
    const { rerender } = renderHook<void, { draft: { speciesQuery: string } }>(
      ({ draft }) => useDraftAutosave("observation:new:1:2", draft, true),
      { initialProps: { draft: { speciesQuery: "Äng" } } },
    );
    rerender({ draft: { speciesQuery: "Ängsvädd" } });

    act(() => jest.advanceTimersByTime(299));
    expect(mockedSaveDraft).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockedSaveDraft).toHaveBeenCalledTimes(1);
    expect(mockedSaveDraft).toHaveBeenCalledWith(
      "observation:new:1:2",
      { speciesQuery: "Ängsvädd" },
    );
  });

  it("saves immediately when the application becomes inactive", () => {
    renderHook(() => useDraftAutosave("locale:new:1", { name: "Lillåsen" }, true));
    act(() => appStateListener?.("background"));
    expect(mockedSaveDraft).toHaveBeenCalledWith("locale:new:1", { name: "Lillåsen" });
  });
});
