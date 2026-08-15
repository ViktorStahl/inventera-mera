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
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import type { Observation } from "@/domain/models";
import { localTimeFromIso } from "@/domain/time";
import { Card } from "@/ui/Card";
import { colors, spacing } from "@/ui/theme";
import {
  LANTMATERIET_MAP_STYLE,
  LANTMATERIET_REQUEST_MATCH,
} from "./lantmateriet";
import { useLantmaterietMapAccess } from "./useLantmaterietMapAccess";

type Props = {
  observations: Observation[];
  fillAvailableSpace?: boolean;
  showObservationList?: boolean;
};

export function ObservationMap({
  observations,
  fillAvailableSpace = false,
  showObservationList = true,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const [mapFailure, setMapFailure] = useState<string>();
  const mapAccess = useLantmaterietMapAccess();
  const selected = observations.find((item) => item.id === selectedId);
  const showNativeMap = mapAccess.status === "available" && !mapFailure;

  return (
    <View style={[styles.wrapper, fillAvailableSpace && styles.wrapperFill]}>
      {showNativeMap ? (
        <NativeObservationMap
          observations={observations}
          authorization={mapAccess.authorization}
          fillAvailableSpace={fillAvailableSpace}
          onFailure={() => setMapFailure("Lantmäteriets karta kunde inte läsas in.")}
        />
      ) : (
        <SchematicMap
          observations={observations}
          onSelect={setSelectedId}
          selectedId={selectedId}
          fillAvailableSpace={fillAvailableSpace}
        />
      )}
      {!showNativeMap ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>{mapNotice(mapAccess.status)}</Text>
          <Text style={styles.noticeText}>{mapFailure ?? mapNoticeDetails(mapAccess)}</Text>
        </View>
      ) : null}
      {selected ? <ObservationSummary observation={selected} /> : null}
      {showObservationList ? <View style={styles.markerList}>
        {observations.map((observation) => (
          <Card
            key={observation.id}
            onPress={() => setSelectedId(observation.id)}
            accessibilityLabel={`Visa ${observation.species.enteredName} på kartan`}
            style={selectedId === observation.id ? styles.selectedCard : undefined}
          >
            <Text style={styles.cardTitle}>{observation.species.preferredName ?? observation.species.enteredName}</Text>
            <Text style={styles.cardMeta}>
              {localTimeFromIso(observation.observedAt)} · {observation.localityName}
            </Text>
          </Card>
        ))}
      </View> : null}
    </View>
  );
}

function NativeObservationMap({
  observations,
  authorization,
  fillAvailableSpace,
  onFailure,
}: {
  observations: Observation[];
  authorization: string;
  fillAvailableSpace: boolean;
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
  const points = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: observations.map((observation) => ({
        type: "Feature",
        id: observation.id,
        properties: { id: observation.id },
        geometry: {
          type: "Point",
          coordinates: [observation.position.wgs84.longitude, observation.position.wgs84.latitude],
        },
      })),
    }),
    [observations],
  );
  const bounds = getBounds(observations);
  if (!requestsReady) {
    return (
      <View style={[styles.mapFrame, fillAvailableSpace && styles.mapFrameFill, styles.loadingMap]}>
        <ActivityIndicator color={colors.green700} size="large" />
      </View>
    );
  }
  return (
    <View style={[styles.mapFrame, fillAvailableSpace && styles.mapFrameFill]}>
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
        <GeoJSONSource id="observations" data={points}>
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

function SchematicMap({
  observations,
  selectedId,
  onSelect,
  fillAvailableSpace,
}: {
  observations: Observation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  fillAvailableSpace: boolean;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const bounds = getCoordinateBounds(observations);
  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }
  return (
    <View style={[styles.mapFrame, fillAvailableSpace && styles.mapFrameFill]} onLayout={handleLayout}>
      <View style={styles.gridHorizontalOne} />
      <View style={styles.gridHorizontalTwo} />
      <View style={styles.gridVerticalOne} />
      <View style={styles.gridVerticalTwo} />
      {observations.map((observation) => {
        const point = projectPoint(observation, bounds, size);
        return (
          <Pressable
            key={observation.id}
            accessibilityRole="button"
            accessibilityLabel={`${observation.species.enteredName}, ${observation.localityName}`}
            onPress={() => onSelect(observation.id)}
            style={[
              styles.marker,
              { left: point.x - 11, top: point.y - 11 },
              selectedId === observation.id && styles.selectedMarker,
            ]}
          />
        );
      })}
      {observations.length === 0 ? (
        <View style={styles.emptyMap}>
          <Text style={styles.emptyMapText}>Inga observationer att visa</Text>
        </View>
      ) : null}
    </View>
  );
}

function ObservationSummary({ observation }: { observation: Observation }) {
  return (
    <Card style={styles.summary}>
      <Text style={styles.cardTitle}>{observation.species.preferredName ?? observation.species.enteredName}</Text>
      {observation.species.scientificName ? (
        <Text style={styles.scientific}>{observation.species.scientificName}</Text>
      ) : null}
      <Text style={styles.cardMeta}>{observation.localityName}</Text>
      <Text style={styles.cardMeta}>
        Nord {Math.round(observation.position.rt90.northing)} · Öst {Math.round(observation.position.rt90.easting)}
      </Text>
    </Card>
  );
}

function getBounds(observations: Observation[]): [number, number, number, number] | undefined {
  if (!observations.length) return undefined;
  const values = getCoordinateBounds(observations);
  const longitudePad = Math.max((values.maxLongitude - values.minLongitude) * 0.1, 0.002);
  const latitudePad = Math.max((values.maxLatitude - values.minLatitude) * 0.1, 0.001);
  return [
    values.minLongitude - longitudePad,
    values.minLatitude - latitudePad,
    values.maxLongitude + longitudePad,
    values.maxLatitude + latitudePad,
  ];
}

function getCoordinateBounds(observations: Observation[]) {
  if (observations.length === 0) {
    return {
      minLatitude: 55,
      maxLatitude: 69,
      minLongitude: 11,
      maxLongitude: 24,
    };
  }
  const latitudes = observations.map((item) => item.position.wgs84.latitude);
  const longitudes = observations.map((item) => item.position.wgs84.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return {
    minLatitude: minLatitude === maxLatitude ? minLatitude - 0.001 : minLatitude,
    maxLatitude: minLatitude === maxLatitude ? maxLatitude + 0.001 : maxLatitude,
    minLongitude: minLongitude === maxLongitude ? minLongitude - 0.002 : minLongitude,
    maxLongitude: minLongitude === maxLongitude ? maxLongitude + 0.002 : maxLongitude,
  };
}

function projectPoint(
  observation: Observation,
  bounds: ReturnType<typeof getCoordinateBounds>,
  size: { width: number; height: number },
) {
  const padding = 24;
  const width = Math.max(1, size.width - padding * 2);
  const height = Math.max(1, size.height - padding * 2);
  const longitudeSpan = Math.max(0.000001, bounds.maxLongitude - bounds.minLongitude);
  const latitudeSpan = Math.max(0.000001, bounds.maxLatitude - bounds.minLatitude);
  return {
    x:
      padding +
      ((observation.position.wgs84.longitude - bounds.minLongitude) / longitudeSpan) * width,
    y:
      padding +
      (1 - (observation.position.wgs84.latitude - bounds.minLatitude) / latitudeSpan) * height,
  };
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  wrapperFill: { flex: 1, minHeight: 0 },
  mapFrame: {
    height: 420,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#EEF1E5",
    overflow: "hidden",
    position: "relative",
  },
  nativeMap: { flex: 1 },
  mapFrameFill: { flex: 1, height: undefined, minHeight: 220 },
  loadingMap: { alignItems: "center", justifyContent: "center" },
  gridHorizontalOne: { position: "absolute", left: 0, right: 0, top: "33%", height: 1, backgroundColor: "#D8DECF" },
  gridHorizontalTwo: { position: "absolute", left: 0, right: 0, top: "66%", height: 1, backgroundColor: "#D8DECF" },
  gridVerticalOne: { position: "absolute", top: 0, bottom: 0, left: "33%", width: 1, backgroundColor: "#D8DECF" },
  gridVerticalTwo: { position: "absolute", top: 0, bottom: 0, left: "66%", width: 1, backgroundColor: "#D8DECF" },
  marker: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green700,
    borderWidth: 3,
    borderColor: "#fff",
  },
  selectedMarker: { backgroundColor: colors.blue, transform: [{ scale: 1.25 }] },
  emptyMap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMapText: { color: colors.textMuted },
  notice: { backgroundColor: "#FFF7E6", borderRadius: 10, padding: spacing.md },
  noticeTitle: { color: colors.warning, fontWeight: "700" },
  noticeText: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
  summary: { borderColor: colors.green700 },
  markerList: { gap: spacing.sm },
  selectedCard: { borderColor: colors.blue, borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardMeta: { color: colors.textMuted },
  scientific: { color: colors.textMuted, fontStyle: "italic" },
});
