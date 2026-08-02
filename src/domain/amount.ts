export const OBSERVATION_UNITS = [
  "stjälkar/strån/skott",
  "plantor/tuvor",
  "m2",
  "dm2",
  "cm2",
] as const;

export type ObservationUnit = (typeof OBSERVATION_UNITS)[number];

export type ObservationAmount = {
  value: number;
  unit: ObservationUnit;
};

export function isObservationUnit(value: unknown): value is ObservationUnit {
  return OBSERVATION_UNITS.some((unit) => unit === value);
}

export function isSupportedObservationAmount(
  amount: unknown,
): amount is ObservationAmount | undefined {
  if (amount === undefined) return true;
  if (!amount || typeof amount !== "object") return false;
  const candidate = amount as { value?: unknown; unit?: unknown };
  return (
    typeof candidate.value === "number" &&
    Number.isFinite(candidate.value) &&
    candidate.value >= 0 &&
    isObservationUnit(candidate.unit)
  );
}

export function assertSupportedObservationAmount(amount: unknown): void {
  if (!isSupportedObservationAmount(amount)) {
    throw new Error("Antal måste ha en av de tillåtna enheterna.");
  }
}
