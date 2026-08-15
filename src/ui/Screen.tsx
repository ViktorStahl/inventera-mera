import type { PropsWithChildren, ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type ScrollViewProps,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "./theme";

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  footer?: ReactNode;
}>;

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  footer,
}: Props) {
  const content = scroll ? (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        footer ? styles.contentWithFooter : undefined,
        contentContainerStyle,
      ]}
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
      {footer ? (
        <KeyboardStickyView testID="keyboard-sticky-footer" style={styles.footer}>
          <View style={styles.footerContent}>{footer}</View>
        </KeyboardStickyView>
      ) : null}
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
  contentWithFooter: { paddingBottom: spacing.xl },
  footer: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerContent: { width: "100%", maxWidth: 760, alignSelf: "center" },
});
