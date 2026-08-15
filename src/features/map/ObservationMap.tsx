import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as NativeMap,
  TransformRequestManager,
} from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Observation } from "@/domain/models";
import { colors, spacing } from "@/ui/theme";
import { ObservationCoordinatePlot, ObservationSummary } from "./ObservationCoordinatePlot";
import {
  LANTMATERIET_MAP_STYLE,
  LANTMATERIET_REQUEST_MATCH,
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
  const showNativeMap = mapAccess.status === "available" && !mapFailure;

  return (
    <View style={styles.wrapper}>
      {showNativeMap ? (
        <NativeObservationMap
          observations={observations}
          authorization={mapAccess.authorization}
          onSelect={setSelectedId}
          onFailure={() => setMapFailure("Lantmäteriets karta kunde inte läsas in.")}
        />
      ) : (
        <ObservationCoordinatePlot
          observations={observations}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
      )}
      {!showNativeMap ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>{mapNotice(mapAccess.status)}</Text>
          <Text style={styles.noticeText}>{mapFailure ?? mapNoticeDetails(mapAccess)}</Text>
        </View>
      ) : null}
      {selected ? <ObservationSummary observation={selected} /> : null}
    </View>
  );
}

function NativeObservationMap({
  observations,
  authorization,
  onSelect,
  onFailure,
}: {
  observations: Observation[];
  authorization: string;
  onSelect: (id: string) => void;
  onFailure: () => void;
}) {
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
        onDidFailLoadingMap={onFailure}
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

function mapNotice(status: ReturnType<typeof useLantmaterietMapAccess>["status"]): string {
  if (status === "loading") return "Kontrollerar kartanslutningen";
  if (status === "missing") return "Lantmäteriets karta är inte ansluten";
  return "Lantmäteriets karta är inte tillgänglig";
}

function mapNoticeDetails(access: ReturnType<typeof useLantmaterietMapAccess>): string {
  if (access.status === "loading") return "Observationerna visas på koordinatnätet under tiden.";
  if (access.status === "missing") {
    return "Lägg till dina kartuppgifter under Inställningar. Koordinatnätet fungerar offline.";
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
  nativeMap: { flex: 1 },
  loadingMap: { alignItems: "center", justifyContent: "center" },
  notice: { backgroundColor: "#FFF7E6", borderRadius: 10, padding: spacing.md },
  noticeTitle: { color: colors.warning, fontWeight: "700" },
  noticeText: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
});
