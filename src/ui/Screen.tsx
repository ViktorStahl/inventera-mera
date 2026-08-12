import type { PropsWithChildren } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type ScrollViewProps,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "./theme";

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
}>;

export function Screen({ children, scroll = true, contentContainerStyle }: Props) {
  const content = scroll ? (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      bottomOffset={spacing.xl}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: 96,
    gap: spacing.lg,
  },
});
