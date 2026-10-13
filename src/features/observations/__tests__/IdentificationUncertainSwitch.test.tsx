import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import { IdentificationUncertainSwitch } from "../IdentificationUncertainSwitch";

function Harness() {
  const [value, setValue] = useState(false);
  return <IdentificationUncertainSwitch value={value} onValueChange={setValue} />;
}

describe("IdentificationUncertainSwitch", () => {
  it("starts unchecked and updates when switched on", () => {
    const view = render(<Harness />);
    const toggle = view.getByLabelText("Osäker artbestämning");

    expect(toggle.props.value).toBe(false);
    fireEvent(toggle, "valueChange", true);
    expect(view.getByLabelText("Osäker artbestämning").props.value).toBe(true);
    expect(view.getByText("Osäker artbestämning")).toBeTruthy();
  });
});
