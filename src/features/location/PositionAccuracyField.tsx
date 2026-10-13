import { Field } from "@/ui/Field";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
};

export function PositionAccuracyField({ value, onChangeText, error }: Props) {
  return (
    <Field
      label="Noggrannhet i meter (valfri)"
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      editable
      error={error}
    />
  );
}
