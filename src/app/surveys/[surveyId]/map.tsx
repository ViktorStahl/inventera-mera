import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import type { Observation, Survey } from "@/domain/models";
import { ObservationMap } from "@/features/map/ObservationMap";
import { getSurvey, listObservations } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { colors } from "@/ui/theme";

export default function SurveyMapScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey>();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!surveyId) return;
      setLoading(true);
      Promise.all([getSurvey(surveyId), listObservations(surveyId)])
        .then(([loadedSurvey, loadedObservations]) => {
          if (!loadedSurvey) throw new Error("Inventeringen kunde inte hittas.");
          setSurvey(loadedSurvey);
          setObservations(loadedObservations);
        })
        .catch((error) => Alert.alert("Kartan kunde inte öppnas", messageOf(error)))
        .finally(() => setLoading(false));
    }, [surveyId]),
  );

  if (loading && !survey) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.green700} size="large" />
      </Screen>
    );
  }
  if (!survey) return null;
  return (
    <Screen>
      <Stack.Screen options={{ title: survey.title }} />
      <View style={styles.tabs} accessibilityRole="tablist">
        <Button label={`Observationer (${observations.length})`} variant="ghost" onPress={() => router.back()} />
        <View style={styles.activeTab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={styles.activeTabText}>Karta</Text>
        </View>
      </View>
      <ObservationMap observations={observations} />
      <Button
        label="Lägg till observation"
        onPress={() =>
          router.push({
            pathname: "/surveys/[surveyId]/observations/new",
            params: { surveyId },
          })
        }
      />
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border },
  activeTab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderColor: colors.green700 },
  activeTabText: { color: colors.green800, fontWeight: "700" },
});
