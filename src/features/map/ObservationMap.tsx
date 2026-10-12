import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import type { Observation } from "@/domain/models";
import { ObservationCoordinatePlot, ObservationSummary } from "./ObservationCoordinatePlot";
import { ObservationMapSurface } from "./ObservationMapSurface";
import { observationMapStyles as styles } from "./observationMapStyles";
import { useLantmaterietMapAccess } from "./useLantmaterietMapAccess";

type Props = {
  observations: Observation[];
};

export function ObservationMap({ observations }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const [mapFailure, setMapFailure] = useState<string>();
  const mapAccess = useLantmaterietMapAccess();
  const selected = observations.find((item) => item.id === selectedId);
  const showProviderMap = mapAccess.status === "available" && !mapFailure;
  const handleMapFailure = useCallback((message: string) => setMapFailure(message), []);

  return (
    <View style={styles.wrapper}>
      {showProviderMap ? (
        <ObservationMapSurface
          observations={observations}
          authorization={mapAccess.authorization}
          onSelect={setSelectedId}
          onFailure={handleMapFailure}
        />
      ) : (
        <ObservationCoordinatePlot
          observations={observations}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
      )}
      {!showProviderMap ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>{mapNotice(mapAccess.status)}</Text>
          <Text style={styles.noticeText}>{mapFailure ?? mapNoticeDetails(mapAccess)}</Text>
        </View>
      ) : null}
      {selected ? <ObservationSummary observation={selected} /> : null}
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
