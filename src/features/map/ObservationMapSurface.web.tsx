import { AttributionControl, type ErrorEvent, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { View } from "react-native";

import type { Observation } from "@/domain/models";
import { colors } from "@/ui/theme";
import { LANTMATERIET_HOST, LANTMATERIET_MAP_STYLE } from "./lantmateriet";
import { getWgs84MapBounds, observationPoints } from "./mapGeometry";
import { observationMapStyles as styles } from "./observationMapStyles";

type Props = {
  observations: Observation[];
  authorization: string;
  onSelect: (id: string) => void;
  onFailure: (message: string) => void;
};

export function ObservationMapSurface({
  observations,
  authorization,
  onSelect,
  onFailure,
}: Props) {
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
          [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
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
