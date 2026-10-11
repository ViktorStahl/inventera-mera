import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ObservationDraft } from "@/domain/models";
import type { ValidationErrors } from "@/domain/validation";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { colors, spacing } from "@/ui/theme";

type Props = {
  localeName: string;
  draft: ObservationDraft;
  errors: ValidationErrors<ObservationDraft>;
  expanded: boolean;
  locating: boolean;
  onToggle: () => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onUseNow: () => void;
  onUseLocaleTime: () => void;
  onNorthingChange: (value: string) => void;
  onEastingChange: (value: string) => void;
  onAccuracyChange: (value: string) => void;
  onCaptureLocation: () => void;
  onUseLocalePosition: () => void;
};

export function ObservationDetailsAccordion({
  localeName,
  draft,
  errors,
  expanded,
  locating,
  onToggle,
  onDateChange,
  onTimeChange,
  onUseNow,
  onUseLocaleTime,
  onNorthingChange,
  onEastingChange,
  onAccuracyChange,
  onCaptureLocation,
  onUseLocalePosition,
}: Props) {
  const status = locating && positionIsMissing(draft)
    ? draft.timeOverridden
      ? "Specifik tid · hämtar ny position…"
      : "Tid följer lokalen · hämtar ny position…"
    : inheritanceStatus(draft);
  return (
    <Card style={observationDetailsHaveErrors(errors) ? styles.errorCard : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? "Dölj" : "Visa och ändra"} tid och position för ${localeName}. ${status}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerText}>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.localeName}>Lokal: {localeName}</Text>
        </View>
        <View style={styles.toggleLabel}>
          <Text style={styles.toggleText}>{expanded ? "Dölj" : "Ändra"}</Text>
          <Text aria-hidden style={styles.chevron}>{expanded ? "⌃" : "⌄"}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Field
                label="Datum"
                value={draft.date}
                onChangeText={onDateChange}
                keyboardType="numbers-and-punctuation"
                error={errors.date}
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Tid"
                value={draft.time}
                onChangeText={onTimeChange}
                keyboardType="numbers-and-punctuation"
                error={errors.time}
              />
            </View>
          </View>
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Button label="Nu" variant="secondary" onPress={onUseNow} />
            </View>
            <View style={styles.column}>
              <Button label="Använd lokalens tid" variant="secondary" onPress={onUseLocaleTime} />
            </View>
          </View>
          <Text style={styles.overrideStatus}>
            {draft.timeOverridden ? "Specifik tid för observationen" : "Följer lokalens tid"}
          </Text>

          <Text style={styles.sectionTitle}>Koordinater · RT90 2,5 gon V</Text>
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Field
                label="Nord (X)"
                value={draft.northing}
                onChangeText={onNorthingChange}
                keyboardType="decimal-pad"
                error={errors.northing}
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Öst (Y)"
                value={draft.easting}
                onChangeText={onEastingChange}
                keyboardType="decimal-pad"
                error={errors.easting}
              />
            </View>
          </View>
          <Field
            label="Noggrannhet i meter (valfri)"
            value={draft.accuracyMeters}
            onChangeText={onAccuracyChange}
            keyboardType="decimal-pad"
            editable={draft.positionSource !== "device"}
            hint={draft.positionSource === "device" ? "Rapporterad av enhetens positionstjänst." : undefined}
            error={errors.accuracyMeters}
          />
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Button
                label="Min position"
                variant="secondary"
                loading={locating}
                onPress={onCaptureLocation}
              />
            </View>
            <View style={styles.column}>
              <Button
                label="Använd lokalens position"
                variant="secondary"
                onPress={onUseLocalePosition}
              />
            </View>
          </View>
          <Text style={styles.overrideStatus}>
            {draft.positionOverridden
              ? "Specifik position för observationen"
              : "Följer lokalens position"}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export function observationDetailsHaveErrors(
  errors: ValidationErrors<ObservationDraft>,
): boolean {
  return Boolean(
    errors.date ||
      errors.time ||
      errors.northing ||
      errors.easting ||
      errors.accuracyMeters,
  );
}

export function inheritanceStatus(draft: ObservationDraft): string {
  if (positionIsMissing(draft)) {
    return draft.timeOverridden
      ? "Specifik tid · ny position krävs"
      : "Tid följer lokalen · ny position krävs";
  }
  if (draft.timeOverridden && draft.positionOverridden) {
    return "Tid och position specifika för observationen";
  }
  if (draft.timeOverridden) return "Tid specifik för observationen · position följer lokalen";
  if (draft.positionOverridden) return "Tid följer lokalen · position specifik för observationen";
  return "Tid och position följer lokalen";
}

function positionIsMissing(draft: ObservationDraft): boolean {
  return draft.positionOverridden && (!draft.northing.trim() || !draft.easting.trim());
}

const styles = StyleSheet.create({
  errorCard: { borderColor: colors.danger },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  pressed: { opacity: 0.72 },
  headerText: { flex: 1, gap: spacing.xs },
  status: { color: colors.text, fontSize: 16, fontWeight: "700" },
  localeName: { color: colors.textMuted, fontSize: 13 },
  toggleLabel: { alignItems: "center", minWidth: 52 },
  toggleText: { color: colors.green800, fontSize: 13, fontWeight: "700" },
  chevron: { color: colors.green800, fontSize: 22, lineHeight: 22 },
  details: {
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.lg,
  },
  twoColumns: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  column: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  overrideStatus: { color: colors.green800, fontSize: 13, marginTop: -spacing.sm },
});
