import {
  clearLantmaterietCredentials,
  getLantmaterietCredentials,
  saveLantmaterietCredentials,
} from "../credentials.web";

describe("browser map credentials", () => {
  beforeEach(async () => {
    await clearLantmaterietCredentials();
  });

  it("keeps credentials only in the current module session", async () => {
    const credentials = { username: "field-user", password: "secret" };

    await saveLantmaterietCredentials(credentials);
    credentials.password = "changed outside storage";

    await expect(getLantmaterietCredentials()).resolves.toEqual({
      username: "field-user",
      password: "secret",
    });
    await clearLantmaterietCredentials();
    await expect(getLantmaterietCredentials()).resolves.toBeNull();
  });
});
