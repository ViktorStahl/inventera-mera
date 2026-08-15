import { useEffect, useState } from "react";

import { messageOf } from "@/ui/errors";
import { getLantmaterietCredentials } from "./credentials";
import {
  lantmaterietAuthorizationHeader,
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
      .then((credentials) => {
        if (!credentials) {
          if (active) setAccess({ status: "missing" });
          return;
        }
        if (active) setAccess(availableAccess(credentials));
      })
      .catch((error) => {
        if (active) setAccess({
          status: "unavailable",
          message: messageOf(error, "Kartan kunde inte anslutas."),
        });
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
