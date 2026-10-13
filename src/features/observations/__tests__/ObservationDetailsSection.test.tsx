import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import type { ObservationDraft } from "@/domain/models";
import {
  ObservationDetailsAccordion,
  inheritanceStatus,
  observationDetailsHaveErrors,
} from "../ObservationDetailsSection";

const inheritedDraft: ObservationDraft = {
  date: "2026-08-12",
  time: "09:15",
  timeOverridden: false,
  identificationUncertain: false,
  northing: "6166984",
  easting: "1322751",
  accuracyMeters: "5",
  positionSource: "device",
  positionOverridden: false,
  latitude: 57.7,
  longitude: 11.9,
  speciesQuery: "",
  amount: "",
  unit: "",
  publicComment: "",
  additionalObservers: "",
  addToSpeciesList: false,
};

const noOp = () => undefined;

function Harness({
  draft = inheritedDraft,
  locating = false,
}: {
  draft?: ObservationDraft;
  locating?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <ObservationDetailsAccordion
      localeName="Lillåsen nord"
      draft={draft}
      errors={{}}
      expanded={expanded}
      locating={locating}
      onToggle={() => setExpanded((current) => !current)}
      onDateChange={noOp}
      onTimeChange={noOp}
      onUseNow={noOp}
      onUseLocaleTime={noOp}
      onNorthingChange={noOp}
      onEastingChange={noOp}
      onAccuracyChange={noOp}
      onCaptureLocation={noOp}
      onUseLocalePosition={noOp}
    />
  );
}

describe("observation inherited details", () => {
  it("reveals the fields directly inside the status accordion", () => {
    const view = render(<Harness />);

    expect(view.getByText("Lokal: Lillåsen nord")).toBeTruthy();
    expect(view.getByText("Tid och position följer lokalen")).toBeTruthy();
    expect(view.queryByLabelText("Datum")).toBeNull();

    const toggle = view.getByLabelText(
      "Visa och ändra tid och position för Lillåsen nord. Tid och position följer lokalen",
    );
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(toggle);

    expect(view.getByLabelText("Datum")).toBeTruthy();
    expect(view.getByLabelText("Nord (X)")).toBeTruthy();
    expect(
      view.getByLabelText(
        "Dölj tid och position för Lillåsen nord. Tid och position följer lokalen",
      ).props.accessibilityState,
    ).toEqual({ expanded: true });
  });

  it("keeps overridden details collapsed until opened and identifies context validation errors", () => {
    const view = render(<Harness draft={{ ...inheritedDraft, positionOverridden: true }} />);
    expect(view.queryByLabelText("Datum")).toBeNull();
    expect(observationDetailsHaveErrors({ speciesQuery: "Ange artnamn." })).toBe(false);
    expect(observationDetailsHaveErrors({ northing: "Ogiltig koordinat." })).toBe(true);
    expect(inheritanceStatus({
      ...inheritedDraft,
      timeOverridden: true,
      positionOverridden: true,
    })).toBe("Tid och position specifika för observationen");
    expect(inheritanceStatus({
      ...inheritedDraft,
      timeOverridden: true,
      positionOverridden: true,
      northing: "",
      easting: "",
    })).toBe("Specifik tid · ny position krävs");
  });

  it("shows that a missing position is being captured automatically", () => {
    const view = render(
      <Harness
        draft={{
          ...inheritedDraft,
          timeOverridden: true,
          positionOverridden: true,
          northing: "",
          easting: "",
        }}
        locating
      />,
    );

    expect(view.getByText("Specifik tid · hämtar ny position…")).toBeTruthy();
  });
});
