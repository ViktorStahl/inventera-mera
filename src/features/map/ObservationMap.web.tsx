import { AttributionControl, type ErrorEvent, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Observation } from "@/domain/models";
import { colors, spacing } from "@/ui/theme";
import { ObservationCoordinatePlot, ObservationSummary } from "./ObservationCoordinatePlot";
import {
  LANTMATERIET_HOST,
  LANTMATERIET_MAP_STYLE,
} from "./lantmateriet";
import { getWgs84MapBounds, observationPoints } from "./mapGeometry";
import { useLantmaterietMapAccess } from "./useLantmaterietMapAccess";

type Props = {
  observations: Observation[];
};

export function ObservationMap({ observations }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const [mapFailure, setMapFailure] = useState<string>();
  const mapAccess = useLantmaterietMapAccess();
  const selected = observations.find((item) => item.id === selectedId);
  const handleMapFailure = useCallback((message: string) => setMapFailure(message), []);
  const showWebMap = mapAccess.status === "available" && !mapFailure;

  return (
    <View style={styles.wrapper}>
      {showWebMap ? (
        <WebObservationMap
          observations={observations}
          authorization={mapAccess.authorization}
          onSelect={setSelectedId}
          onFailure={handleMapFailure}
        />
      ) : (
        <ObservationCoordinatePlot
          observations={observations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
      {!showWebMap ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>{mapNotice(mapAccess.status)}</Text>
          <Text style={styles.noticeText}>{mapFailure ?? mapNoticeDetails(mapAccess)}</Text>
        </View>
      ) : null}
      {selected ? <ObservationSummary observation={selected} /> : null}
    </View>
  );
}

function WebObservationMap({
  observations,
  authorization,
  onSelect,
  onFailure,
}: {
  observations: Observation[];
  authorization: string;
  onSelect: (id: string) => void;
  onFailure: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: LANTMATERIET_MAP_STYLE,
      center: [15.5, 62],
      zoom: 4,
      minZoom: 0,
      maxZoom: 14,
      attributionControl: false,
      transformRequest: (url) =>
        url.startsWith(`${LANTMATERIET_HOST}/open/topowebb-ccby/v1/wmts`)
          ? { url, headers: { Authorization: authorization } }
          : { url },
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    const handleError = (event: ErrorEvent) => {
      const message = event.error?.message ?? "";
      if (/401|403|fetch|network|image/i.test(message)) {
        onFailure("Lantmäteriets karta kunde inte läsas in. Koordinatnätet visas i stället.");
      }
    };
    map.on("error", handleError);
    map.on("load", () => {
      map.addSource("observations", {
        type: "geojson",
        data: observationPoints(observations),
      });
      map.addLayer({
        id: "observation-points",
        type: "circle",
        source: "observations",
        paint: {
          "circle-radius": 8,
          "circle-color": colors.green700,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        },
      });
      map.on("click", "observation-points", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelect(id);
      });
      map.on("mouseenter", "observation-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "observation-points", () => {
        map.getCanvas().style.cursor = "";
      });
      const bounds = getWgs84MapBounds(observations);
      if (bounds) {
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 48, duration: 0, maxZoom: 14 },
        );
      }
    });
    return () => map.remove();
  }, [authorization, observations, onFailure, onSelect]);

  return (
    <View style={styles.mapFrame}>
      <div ref={container} style={{ height: "100%", width: "100%" }} />
    </View>
  );
}

function mapNotice(status: ReturnType<typeof useLantmaterietMapAccess>["status"]): string {
  if (status === "loading") return "Kontrollerar kartanslutningen";
  if (status === "missing") return "Lantmäteriets karta är inte ansluten";
  return "Lantmäteriets karta är inte tillgänglig";
}

function mapNoticeDetails(access: ReturnType<typeof useLantmaterietMapAccess>): string {
  if (access.status === "loading") return "Observationerna visas på koordinatnätet under tiden.";
  if (access.status === "missing") {
    return "Lägg till uppgifterna under Inställningar. De används bara under den här webbsessionen.";
  }
  if (access.status === "unavailable") return `${access.message} Koordinatnätet visas i stället.`;
  return "Koordinatnätet visas i stället.";
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, minHeight: 0, gap: spacing.md },
  mapFrame: {
    flex: 1,
    minHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#EEF1E5",
    overflow: "hidden",
    position: "relative",
  },
  notice: { backgroundColor: "#FFF7E6", borderRadius: 10, padding: spacing.md },
  noticeTitle: { color: colors.warning, fontWeight: "700" },
  noticeText: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
});
