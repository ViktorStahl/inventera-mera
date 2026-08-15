import { useEffect, useState } from "react";

import { getLantmaterietCredentials } from "./credentials";
import {
  lantmaterietAuthorizationHeader,
  verifyLantmaterietCredentials,
  type LantmaterietCredentials,
} from "./lantmateriet";

type MapAccess =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "unavailable"; message: string }
  | { status: "available"; authorization: string };

export function useLantmaterietMapAccess(): MapAccess {
  const [access, setAccess] = useState<MapAccess>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getLantmaterietCredentials()
      .then(async (credentials) => {
        if (!credentials) {
          if (active) setAccess({ status: "missing" });
          return;
        }
        await verifyLantmaterietCredentials(credentials);
        if (active) setAccess(availableAccess(credentials));
      })
      .catch((error) => {
        if (active) setAccess({ status: "unavailable", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, []);

  return access;
}

function availableAccess(credentials: LantmaterietCredentials): MapAccess {
  return {
    status: "available",
    authorization: lantmaterietAuthorizationHeader(credentials),
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Kartan kunde inte anslutas.";
}
