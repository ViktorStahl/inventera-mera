import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { Taxon } from "@/domain/models";
import { searchTaxa } from "@/storage/database";
import { useSpeciesSuggestions } from "../useSpeciesSuggestions";

jest.mock("@/storage/database", () => ({
  searchTaxa: jest.fn(),
}));

const mockedSearchTaxa = jest.mocked(searchTaxa);

describe("useSpeciesSuggestions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedSearchTaxa.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips superseded queued prefixes and only displays the newest search", async () => {
    const firstSearch = deferred<Taxon[]>();
    const poiResult = taxon("poi", "indiskt droppgräs", "Sporobolus indicus");
    mockedSearchTaxa.mockImplementation((query) => {
      if (query === "p") return firstSearch.promise;
      if (query === "poi") return Promise.resolve([poiResult]);
      return Promise.resolve([]);
    });

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSpeciesSuggestions({ query, limit: 20 }),
      { initialProps: { query: "p" } },
    );

    act(() => jest.advanceTimersByTime(100));
    expect(mockedSearchTaxa).toHaveBeenCalledWith("p", 20, undefined, undefined);

    rerender({ query: "po" });
    act(() => jest.advanceTimersByTime(100));
    rerender({ query: "poi" });
    act(() => jest.advanceTimersByTime(100));

    expect(result.current).toEqual({ results: [], loading: true });

    await act(async () => {
      firstSearch.resolve([taxon("p", "pors", "Myrica gale")]);
      await firstSearch.promise;
    });

    await waitFor(() => {
      expect(result.current).toEqual({ results: [poiResult], loading: false });
    });
    expect(mockedSearchTaxa.mock.calls.map(([query]) => query)).toEqual(["p", "poi"]);
  });

  it("debounces rapid typing into one search", async () => {
    mockedSearchTaxa.mockResolvedValue([]);
    const { rerender } = renderHook(
      ({ query }: { query: string }) => useSpeciesSuggestions({ query, limit: 20 }),
      { initialProps: { query: "p" } },
    );

    rerender({ query: "po" });
    rerender({ query: "poi" });
    act(() => jest.advanceTimersByTime(99));
    expect(mockedSearchTaxa).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(mockedSearchTaxa).toHaveBeenCalledTimes(1);
    expect(mockedSearchTaxa).toHaveBeenCalledWith("poi", 20, undefined, undefined);
  });
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value) {
      resolvePromise?.(value);
    },
  };
}

function taxon(id: string, preferredName: string, scientificName: string): Taxon {
  return {
    id,
    preferredName,
    scientificName,
    synonyms: [],
    rank: "species",
    status: "accepted",
  };
}
