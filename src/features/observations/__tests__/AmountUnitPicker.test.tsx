import { fireEvent, render } from "@testing-library/react-native";

import { OBSERVATION_UNITS } from "@/domain/amount";
import { AmountUnitPicker } from "../AmountUnitPicker";

describe("AmountUnitPicker", () => {
  it("renders only the approved units and toggles the selected unit", () => {
    const onChange = jest.fn();
    const screen = render(
      <AmountUnitPicker value="" onChange={onChange} />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(OBSERVATION_UNITS.length);
    for (const unit of OBSERVATION_UNITS) {
      expect(screen.getByLabelText(`Enhet ${unit}`)).toBeTruthy();
    }

    fireEvent.press(screen.getByLabelText("Enhet plantor/tuvor"));
    expect(onChange).toHaveBeenCalledWith("plantor/tuvor");

    screen.rerender(<AmountUnitPicker value="plantor/tuvor" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText("Avmarkera enhet plantor/tuvor"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
