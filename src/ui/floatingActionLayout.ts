import { spacing } from "./theme";

const FLOATING_ACTION_SIZE = 58;
const MINIMUM_CONTENT_PADDING_BOTTOM = 120;

export function floatingActionLayout(insets: { bottom: number; right: number }) {
  const bottom = Math.max(spacing.xl, insets.bottom + spacing.md);
  const right = Math.max(spacing.xl, insets.right + spacing.md);
  return {
    bottom,
    right,
    contentPaddingBottom: Math.max(
      MINIMUM_CONTENT_PADDING_BOTTOM,
      bottom + FLOATING_ACTION_SIZE + spacing.xl,
    ),
  };
}
