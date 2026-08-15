import {
  LANTMATERIET_CAPABILITIES_URL,
  LANTMATERIET_MAP_STYLE,
  LANTMATERIET_TILE_URL,
  lantmaterietAuthorizationHeader,
  validateLantmaterietCredentials,
  verifyLantmaterietCredentials,
} from "../lantmateriet";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
});

afterAll(() => {
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: originalFetch });
});

describe("Lantmäteriet map configuration", () => {
  it("builds a Basic authorization header without putting credentials in the URL", () => {
    expect(lantmaterietAuthorizationHeader({ username: "user", password: "pass" })).toBe(
      "Basic dXNlcjpwYXNz",
    );
    expect(
      lantmaterietAuthorizationHeader({ username: "användare", password: "lösen" }),
    ).toBe("Basic YW52w6RuZGFyZTpsw7ZzZW4=");
    expect(LANTMATERIET_CAPABILITIES_URL).not.toContain("user");
    expect(LANTMATERIET_TILE_URL).not.toContain("pass");
  });

  it("uses the coloured topowebb Web Mercator raster layer", () => {
    const source = LANTMATERIET_MAP_STYLE.sources.lantmateriet;

    expect(source).toMatchObject({ type: "raster", tileSize: 256, minzoom: 0, maxzoom: 14 });
    expect(LANTMATERIET_TILE_URL).toContain("layer=topowebb");
    expect(LANTMATERIET_TILE_URL).toContain("tilematrixset=3857");
    expect(LANTMATERIET_TILE_URL).toContain("tilematrix={z}");
    expect(LANTMATERIET_TILE_URL).toContain("tilerow={y}");
    expect(LANTMATERIET_TILE_URL).toContain("tilecol={x}");
  });

  it("trims the username but preserves the password exactly", () => {
    expect(validateLantmaterietCredentials({ username: "  field-user ", password: " pass " })).toEqual({
      username: "field-user",
      password: " pass ",
    });
    expect(() => validateLantmaterietCredentials({ username: "", password: "pass" })).toThrow(
      "Ange användarnamn",
    );
    expect(() => validateLantmaterietCredentials({ username: "user", password: "" })).toThrow(
      "Ange lösenord",
    );
  });

  it("accepts capabilities containing topowebb and matrix set 3857", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        "<Capabilities><ows:Identifier>topowebb</ows:Identifier><ows:Identifier>3857</ows:Identifier></Capabilities>",
    });

    await expect(
      verifyLantmaterietCredentials({ username: "user", password: "pass" }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      LANTMATERIET_CAPABILITIES_URL,
      expect.objectContaining({
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      }),
    );
  });

  it("reports rejected credentials without exposing them", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "" });

    await expect(
      verifyLantmaterietCredentials({ username: "user", password: "secret" }),
    ).rejects.toThrow("avvisade användarnamnet eller lösenordet");
  });
});
