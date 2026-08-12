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
});
