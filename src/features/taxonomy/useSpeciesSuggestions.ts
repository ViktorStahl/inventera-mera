import { useCallback, useEffect, useRef, useState } from "react";

import type { Taxon } from "@/domain/models";
import { searchTaxa } from "@/storage/database";

type SpeciesSearchRequest = {
  key: string;
  query: string;
  limit: number;
  speciesListId?: string;
  taxonomyPackageId?: string;
};

type CompletedSpeciesSearch = {
  key: string;
  taxa: Taxon[];
};

export function useSpeciesSuggestions({
  query,
  limit,
  speciesListId,
  taxonomyPackageId,
  enabled = true,
}: {
  query: string;
  limit: number;
  speciesListId?: string;
  taxonomyPackageId?: string;
  enabled?: boolean;
}): { results: Taxon[]; loading: boolean } {
  const normalizedQuery = query.trim();
  const key = speciesSearchKey(query, limit, speciesListId, taxonomyPackageId);
  const currentKey = enabled && normalizedQuery ? key : undefined;
  const [completed, setCompleted] = useState<CompletedSpeciesSearch>();
  const pending = useRef<SpeciesSearchRequest | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const activeKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    activeKey.current = currentKey;
    pending.current = null;
    return () => {
      mounted.current = false;
    };
  }, [currentKey]);

  const drainPendingSearch = useCallback(async function drainPendingSearch(): Promise<void> {
    if (running.current) return;
    running.current = true;
    try {
      while (pending.current) {
        const request = pending.current;
        pending.current = null;
        let taxa: Taxon[];
        try {
          taxa = await searchTaxa(
            request.query,
            request.limit,
            request.speciesListId,
            request.taxonomyPackageId,
          );
        } catch {
          taxa = [];
        }
        if (mounted.current && activeKey.current === request.key) {
          setCompleted({ key: request.key, taxa });
        }
      }
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!currentKey) return;
    const request: SpeciesSearchRequest = {
      key: currentKey,
      query,
      limit,
      speciesListId,
      taxonomyPackageId,
    };
    const timeout = setTimeout(() => {
      pending.current = request;
      void drainPendingSearch();
    }, 100);
    return () => clearTimeout(timeout);
  }, [currentKey, drainPendingSearch, limit, query, speciesListId, taxonomyPackageId]);

  return {
    results: currentKey && completed?.key === currentKey ? completed.taxa : [],
    loading: Boolean(currentKey && completed?.key !== currentKey),
  };
}

function speciesSearchKey(
  query: string,
  limit: number,
  speciesListId?: string,
  taxonomyPackageId?: string,
): string {
  return JSON.stringify([query.trim(), limit, speciesListId ?? "", taxonomyPackageId ?? ""]);
}
