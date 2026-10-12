import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as NativeMap,
  TransformRequestManager,
} from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import type { Observation } from "@/domain/models";
import { colors } from "@/ui/theme";
import { LANTMATERIET_MAP_STYLE, LANTMATERIET_REQUEST_MATCH } from "./lantmateriet";
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
  const [requestsReady, setRequestsReady] = useState(false);
  useEffect(() => {
    let active = true;
    TransformRequestManager.addHeader({
      id: "lantmateriet-basic-auth",
      match: LANTMATERIET_REQUEST_MATCH,
      name: "Authorization",
      value: authorization,
    });
    queueMicrotask(() => {
      if (active) setRequestsReady(true);
    });
    return () => {
      active = false;
      TransformRequestManager.removeHeader("lantmateriet-basic-auth");
    };
  }, [authorization]);

  const points = useMemo(() => observationPoints(observations), [observations]);
  const bounds = getWgs84MapBounds(observations);
  if (!requestsReady) {
    return (
      <View style={[styles.mapFrame, styles.loadingMap]}>
        <ActivityIndicator color={colors.green700} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.mapFrame}>
      <NativeMap
        mapStyle={LANTMATERIET_MAP_STYLE}
        style={styles.nativeMap}
        attribution
        logo={false}
        onDidFailLoadingMap={() => onFailure("Lantmäteriets karta kunde inte läsas in.")}
      >
        <Camera
          initialViewState={
            bounds
              ? { bounds, padding: { top: 48, right: 48, bottom: 48, left: 48 } }
              : { center: [15.5, 62], zoom: 4 }
          }
        />
        <GeoJSONSource
          id="observations"
          data={points}
          onPress={(event) => {
            const id = event.nativeEvent.features[0]?.properties?.id;
            if (typeof id === "string") onSelect(id);
          }}
        >
          <Layer
            id="observation-points"
            type="circle"
            source="observations"
            paint={{
              "circle-radius": 8,
              "circle-color": colors.green700,
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 2,
            }}
          />
        </GeoJSONSource>
      </NativeMap>
    </View>
  );
}
