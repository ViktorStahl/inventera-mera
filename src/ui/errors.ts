export function messageOf(
  error: unknown,
  fallback = "Ett oväntat fel uppstod.",
): string {
  return error instanceof Error ? error.message : fallback;
}
