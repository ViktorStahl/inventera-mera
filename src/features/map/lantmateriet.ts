import type { StyleSpecification } from "maplibre-gl";

export type LantmaterietCredentials = {
  username: string;
  password: string;
};

export const LANTMATERIET_HOST = "https://maps.lantmateriet.se";
export const LANTMATERIET_REQUEST_MATCH =
  "^https://maps\\.lantmateriet\\.se/open/topowebb-ccby/v1/wmts";
export const LANTMATERIET_CAPABILITIES_URL =
  `${LANTMATERIET_HOST}/open/topowebb-ccby/v1/wmts` +
  "?request=GetCapabilities&version=1.0.0&service=wmts";
export const LANTMATERIET_TILE_URL =
  `${LANTMATERIET_HOST}/open/topowebb-ccby/v1/wmts` +
  "?service=WMTS&request=GetTile&version=1.0.0" +
  "&layer=topowebb&style=default&tilematrixset=3857" +
  "&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/png";

export const LANTMATERIET_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    lantmateriet: {
      type: "raster",
      tiles: [LANTMATERIET_TILE_URL],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 14,
      attribution: "Lantmäteriet · Topografisk webbkarta",
    },
  },
  layers: [
    {
      id: "lantmateriet-topowebb",
      type: "raster",
      source: "lantmateriet",
      minzoom: 0,
      maxzoom: 15,
    },
  ],
};

export function normalizeLantmaterietCredentials(
  credentials: LantmaterietCredentials,
): LantmaterietCredentials {
  return {
    username: credentials.username.trim(),
    password: credentials.password,
  };
}

export function validateLantmaterietCredentials(
  credentials: LantmaterietCredentials,
): LantmaterietCredentials {
  const normalized = normalizeLantmaterietCredentials(credentials);
  if (!normalized.username) throw new Error("Ange användarnamn för Lantmäteriet.");
  if (!normalized.password) throw new Error("Ange lösenord för Lantmäteriet.");
  return normalized;
}

export function lantmaterietAuthorizationHeader(
  credentials: LantmaterietCredentials,
): string {
  const normalized = validateLantmaterietCredentials(credentials);
  return `Basic ${base64Utf8(`${normalized.username}:${normalized.password}`)}`;
}

export async function verifyLantmaterietCredentials(
  credentials: LantmaterietCredentials,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(LANTMATERIET_CAPABILITIES_URL, {
      headers: { Authorization: lantmaterietAuthorizationHeader(credentials) },
    });
  } catch {
    throw new Error("Det gick inte att nå Lantmäteriets karttjänst.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Lantmäteriet avvisade användarnamnet eller lösenordet.");
  }
  if (!response.ok) {
    throw new Error(`Lantmäteriets karttjänst svarade med status ${response.status}.`);
  }
  const capabilities = await response.text();
  if (
    !capabilities.includes("<ows:Identifier>topowebb</ows:Identifier>") ||
    !capabilities.includes("<ows:Identifier>3857</ows:Identifier>")
  ) {
    throw new Error("Lantmäteriets karttjänst saknar det förväntade färglagret.");
  }
}

function base64Utf8(value: string): string {
  const bytes = utf8Bytes(value);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    encoded += second == null ? "=" : alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    encoded += third == null ? "=" : alphabet[third & 63];
  }
  return encoded;
}

function utf8Bytes(value: string): number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === "%") {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return bytes;
}
