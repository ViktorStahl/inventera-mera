import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import type { Observation } from "@/domain/models";
import { Card } from "@/ui/Card";
import { colors } from "@/ui/theme";
import { getWgs84CoordinateBounds, projectObservation } from "./mapGeometry";

export function ObservationCoordinatePlot({
  observations,
  selectedId,
  onSelect,
}: {
  observations: Observation[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const bounds = getWgs84CoordinateBounds(observations);

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
        const point = projectObservation(observation, bounds, size);
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

export function ObservationSummary({ observation }: { observation: Observation }) {
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

const styles = StyleSheet.create({
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
  summary: { borderColor: colors.green700 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardMeta: { color: colors.textMuted },
  scientific: { color: colors.textMuted, fontStyle: "italic" },
});
