import { render } from "@testing-library/react-native";
import { Platform, ScrollView, Text } from "react-native";

import appConfig from "../../../app.json";
import { Screen } from "../Screen";

describe("mobile keyboard layout", () => {
  it("configures Android to resize the application around the keyboard", () => {
    expect(appConfig.expo.android.softwareKeyboardLayoutMode).toBe("resize");
  });

  it("uses native keyboard-aware scrolling with clearance below the focused input", () => {
    const view = render(
      <Screen>
        <Text>Form</Text>
      </Screen>,
    );
    const scrollView = view.UNSAFE_getByType(ScrollView);

    const expectedMode = Platform.OS === "ios"
      ? "interactive"
      : Platform.OS === "android"
        ? "on-drag"
        : "none";
    expect(scrollView.props.keyboardDismissMode).toBe(expectedMode);
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("handled");
    expect(scrollView.props.bottomOffset).toBe(24);
  });

  it("can keep a form action in a keyboard-sticky footer", () => {
    const view = render(
      <Screen footer={<Text>Spara observation</Text>}>
        <Text>Form</Text>
      </Screen>,
    );

    expect(view.getByTestId("keyboard-sticky-footer")).toBeTruthy();
    expect(view.getByText("Spara observation")).toBeTruthy();
  });

  it("can render an interactive viewport without any parent scroller", () => {
    const view = render(
      <Screen scroll={false}>
        <Text>Karta</Text>
      </Screen>,
    );

    expect(view.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  });
});
