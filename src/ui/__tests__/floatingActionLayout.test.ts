import { floatingActionLayout } from "../floatingActionLayout";

describe("floating action button layout", () => {
  it("keeps the normal spacing when no system inset is present", () => {
    expect(floatingActionLayout({ bottom: 0, right: 0 })).toEqual({
      bottom: 24,
      right: 24,
      contentPaddingBottom: 120,
    });
  });

  it("moves the button and list content above a navigation bar", () => {
    expect(floatingActionLayout({ bottom: 48, right: 8 })).toEqual({
      bottom: 60,
      right: 24,
      contentPaddingBottom: 142,
    });
  });
});
