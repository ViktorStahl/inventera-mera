import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import {
  acknowledgeAchievement,
  evaluateAchievements as evaluateAchievementAwards,
  listAchievementAwards,
  resetAchievements as clearAchievementAwards,
} from "@/storage/database";
import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementAward,
  type AchievementId,
} from "@/domain/achievements";
import { Button } from "@/ui/Button";
import { colors, spacing } from "@/ui/theme";

type AchievementContextValue = {
  awards: AchievementAward[];
  initialized: boolean;
  evaluate: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
  acknowledge: (achievementId: AchievementId) => Promise<void>;
};

const AchievementContext = createContext<AchievementContextValue | null>(null);

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [awards, setAwards] = useState<AchievementAward[]>([]);
  const [initialized, setInitialized] = useState(false);

  const refresh = useCallback(async () => {
    setAwards(await listAchievementAwards());
  }, []);

  const evaluate = useCallback(async () => {
    try {
      await evaluateAchievementAwards();
    } finally {
      await refresh();
    }
  }, [refresh]);

  const reset = useCallback(async () => {
    await clearAchievementAwards();
    await refresh();
  }, [refresh]);

  const acknowledge = useCallback(async (achievementId: AchievementId) => {
    await acknowledgeAchievement(achievementId);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    void evaluate()
      .catch(() => refresh().catch(() => undefined))
      .finally(() => {
        if (active) setInitialized(true);
      });
    return () => {
      active = false;
    };
  }, [evaluate, refresh]);

  const value = useMemo<AchievementContextValue>(
    () => ({ awards, initialized, evaluate, refresh, reset, acknowledge }),
    [awards, initialized, evaluate, refresh, reset, acknowledge],
  );
  const pendingAward = awards.find((award) => award.acknowledgedAt === null);

  return (
    <AchievementContext.Provider value={value}>
      {children}
      {pendingAward ? (
        <AchievementPopup
          award={pendingAward}
          onDismiss={() => {
            void acknowledge(pendingAward.achievementId).catch(() => undefined);
          }}
        />
      ) : null}
    </AchievementContext.Provider>
  );
}

export function useAchievements(): AchievementContextValue {
  const context = useContext(AchievementContext);
  if (!context) throw new Error("useAchievements must be used inside AchievementProvider");
  return context;
}

export function AchievementIcon({ size = 56 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Prestation"
      style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={{ fontSize: size * 0.52 }}>🏆</Text>
    </View>
  );
}

export function AchievementTitle({
  achievementId,
  style,
}: {
  achievementId: AchievementId;
  style?: StyleProp<TextStyle>;
}) {
  const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === achievementId);
  if (!definition) return null;

  const scientificName = "scientificName" in definition ? definition.scientificName : undefined;
  const scientificNameStart = scientificName ? definition.title.indexOf(scientificName) : -1;
  if (!scientificName || scientificNameStart < 0) {
    return <Text accessibilityRole="header" style={style}>{definition.title}</Text>;
  }

  return (
    <Text accessibilityRole="header" style={style}>
      {definition.title.slice(0, scientificNameStart)}
      <Text style={styles.scientificName}>{scientificName}</Text>
      {definition.title.slice(scientificNameStart + scientificName.length)}
    </Text>
  );
}

function AchievementPopup({
  award,
  onDismiss,
}: {
  award: AchievementAward;
  onDismiss: () => void;
}) {
  const definition = ACHIEVEMENT_DEFINITIONS.find(
    (item) => item.id === award.achievementId,
  );
  if (!definition) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.popup}>
          <AchievementIcon size={80} />
          <Text style={styles.popupEyebrow}>Ny prestation!</Text>
          <AchievementTitle
            achievementId={award.achievementId}
            style={styles.popupTitle}
          />
          <Text style={styles.description}>{definition.description}</Text>
          <Text style={styles.date}>Uppnådd {formatAchievementDate(award.achievedAt)}</Text>
          <Button label="Härligt!" onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

export function formatAchievementDate(achievedAt: string): string {
  const date = new Date(achievedAt);
  if (!Number.isFinite(date.getTime())) return achievedAt;
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "long" }).format(date);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  popup: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green100,
  },
  popupEyebrow: { color: colors.green800, fontSize: 14, fontWeight: "700" },
  popupTitle: { color: colors.text, fontSize: 22, fontWeight: "700", textAlign: "center" },
  scientificName: { fontStyle: "italic" },
  description: { color: colors.text, lineHeight: 22, textAlign: "center" },
  date: { color: colors.textMuted, fontSize: 14 },
});
