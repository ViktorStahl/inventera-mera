import * as SecureStore from "expo-secure-store";

import {
  clearLantmaterietCredentials,
  getLantmaterietCredentials,
  saveLantmaterietCredentials,
} from "../credentials";

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsyncMock = jest.mocked(SecureStore.getItemAsync);
const setItemAsyncMock = jest.mocked(SecureStore.setItemAsync);
const deleteItemAsyncMock = jest.mocked(SecureStore.deleteItemAsync);
let storedValue: string | null = null;

describe("native map credentials", () => {
  beforeEach(() => {
    storedValue = null;
    jest.clearAllMocks();
    getItemAsyncMock.mockImplementation(async () => storedValue);
    setItemAsyncMock.mockImplementation(async (_key, value) => {
      storedValue = value;
    });
    deleteItemAsyncMock.mockImplementation(async () => {
      storedValue = null;
    });
  });

  it("round-trips credentials through SecureStore", async () => {
    await saveLantmaterietCredentials({ username: "field-user", password: "secret" });

    await expect(getLantmaterietCredentials()).resolves.toEqual({
      username: "field-user",
      password: "secret",
    });
    expect(setItemAsyncMock).toHaveBeenCalledWith(
      "lantmateriet-wmts-credentials",
      JSON.stringify({ username: "field-user", password: "secret" }),
      { keychainAccessible: 6 },
    );
  });

  it("deletes invalid or explicitly cleared credentials", async () => {
    storedValue = "not-json";
    await expect(getLantmaterietCredentials()).resolves.toBeNull();
    expect(deleteItemAsyncMock).toHaveBeenCalled();

    storedValue = JSON.stringify({ username: "field-user", password: "secret" });
    await clearLantmaterietCredentials();
    expect(storedValue).toBeNull();
  });
});
