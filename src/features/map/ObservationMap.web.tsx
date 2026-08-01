import { useState } from "react";
import {
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

export function ObservationMap({ observations }: { observations: Observation[] }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = observations.find((item) => item.id === selectedId);

  return (
    <View style={styles.wrapper}>
      <CoordinatePlot observations={observations} selectedId={selectedId} onSelect={setSelectedId} />
      <View style={styles.notice} accessibilityRole="alert">
        <Text style={styles.noticeTitle}>Webbförhandsvisning</Text>
        <Text style={styles.noticeText}>
          Observationerna visas lokalt i ett koordinatnät. Lantmäteriets rasterkarta används i
          den native appen när en godkänd kartstil har konfigurerats.
        </Text>
      </View>
      {selected ? <ObservationSummary observation={selected} /> : null}
      <View style={styles.markerList}>
        {observations.map((observation) => (
          <Card
            key={observation.id}
            onPress={() => setSelectedId(observation.id)}
            accessibilityLabel={`Visa ${observation.species.enteredName} på kartan`}
            style={selectedId === observation.id ? styles.selectedCard : undefined}
          >
            <Text style={styles.cardTitle}>
              {observation.species.preferredName ?? observation.species.enteredName}
            </Text>
            <Text style={styles.cardMeta}>
              {localTimeFromIso(observation.observedAt)} · {observation.localityName}
            </Text>
          </Card>
        ))}
      </View>
    </View>
  );
}

function CoordinatePlot({
  observations,
  selectedId,
  onSelect,
}: {
  observations: Observation[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const bounds = getCoordinateBounds(observations);
  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }
  return (
    <View style={styles.mapFrame} onLayout={handleLayout}>
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
      <Text style={styles.cardTitle}>
        {observation.species.preferredName ?? observation.species.enteredName}
      </Text>
      {observation.species.scientificName ? (
        <Text style={styles.scientific}>{observation.species.scientificName}</Text>
      ) : null}
      <Text style={styles.cardMeta}>{observation.localityName}</Text>
      <Text style={styles.cardMeta}>
        Nord {Math.round(observation.position.rt90.northing)} · Öst{" "}
        {Math.round(observation.position.rt90.easting)}
      </Text>
    </Card>
  );
}

function getCoordinateBounds(observations: Observation[]) {
  if (observations.length === 0) {
    return { minNorthing: 6_100_000, maxNorthing: 7_700_000, minEasting: 1_200_000, maxEasting: 1_900_000 };
  }
  const northings = observations.map((item) => item.position.rt90.northing);
  const eastings = observations.map((item) => item.position.rt90.easting);
  const minNorthing = Math.min(...northings);
  const maxNorthing = Math.max(...northings);
  const minEasting = Math.min(...eastings);
  const maxEasting = Math.max(...eastings);
  return {
    minNorthing: minNorthing === maxNorthing ? minNorthing - 10 : minNorthing,
    maxNorthing: minNorthing === maxNorthing ? maxNorthing + 10 : maxNorthing,
    minEasting: minEasting === maxEasting ? minEasting - 10 : minEasting,
    maxEasting: minEasting === maxEasting ? maxEasting + 10 : maxEasting,
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
  return {
    x:
      padding +
      ((observation.position.rt90.easting - bounds.minEasting) /
        (bounds.maxEasting - bounds.minEasting)) *
        width,
    y:
      padding +
      (1 -
        (observation.position.rt90.northing - bounds.minNorthing) /
          (bounds.maxNorthing - bounds.minNorthing)) *
        height,
  };
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  mapFrame: {
    height: 380,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#EEF1E5",
    overflow: "hidden",
    position: "relative",
  },
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
    borderColor: "#FFFFFF",
  },
  selectedMarker: { backgroundColor: colors.blue, transform: [{ scale: 1.25 }] },
  emptyMap: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
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
