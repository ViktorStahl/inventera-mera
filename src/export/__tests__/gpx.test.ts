import type { Observation, Survey } from "@/domain/models";
import { createSurveyGpx } from "../gpx";

const survey: Survey = {
  id: "survey-1",
  title: "Äng & skog",
  description: "En fältinventering",
  surveyDate: "2026-07-31",
  status: "active",
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
};

const observation: Observation = {
  id: "observation-1",
  surveyId: survey.id,
  localeId: "locale-1",
  observedAt: "2026-07-31T10:14:00+02:00",
  timeZone: "Europe/Stockholm",
  localityName: "Lillåsen & bäcken",
  timeOverridden: true,
  positionOverridden: true,
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" },
    accuracyMeters: 4.2,
    source: "device",
  },
  species: {
    source: "taxonomy",
    enteredName: "Ängsvädd",
    preferredName: "Ängsvädd",
    scientificName: "Succisa pratensis",
  },
  amount: { value: 0, unit: "plantor/tuvor" },
  publicComment: "Fuktig jord & skugga",
  additionalObservers: ["Ada", "Bo"],
  createdAt: "2026-07-31T08:14:00.000Z",
  updatedAt: "2026-07-31T08:14:00.000Z",
};

describe("GPX export", () => {
  it("exports observations as sorted GPX 1.1 waypoints with WGS84 data", () => {
    const later = {
      ...observation,
      id: "observation-2",
      observedAt: "2026-07-31T11:00:00+02:00",
      species: { source: "free-text" as const, enteredName: "Skogsstjärna" },
      position: {
        ...observation.position,
        wgs84: { latitude: 58.1, longitude: 12.4 },
      },
    };
    const earlierByInstant = {
      ...observation,
      id: "observation-offset",
      observedAt: "2026-07-31T11:00:00+03:00",
      species: { source: "free-text" as const, enteredName: "Tidszonstest" },
    };
    const gpx = createSurveyGpx(survey, [later, observation, earlierByInstant]);

    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1" creator="Inventera mera"');
    expect(gpx).toContain("<name>Äng &amp; skog</name>");
    expect(gpx.match(/<wpt\b/g)).toHaveLength(3);
    expect(gpx.indexOf("<name>Tidszonstest</name>")).toBeLessThan(
      gpx.indexOf("<name>Ängsvädd</name>"),
    );
    expect(gpx.indexOf("<name>Ängsvädd</name>")).toBeLessThan(
      gpx.indexOf("<name>Skogsstjärna</name>"),
    );
    expect(gpx).toContain('<wpt lat="57.7" lon="11.9">');
    expect(gpx).toContain("<time>2026-07-31T10:14:00+02:00</time>");
    expect(gpx).toContain("Lokal: Lillåsen &amp; bäcken");
    expect(gpx).toContain("Vetenskapligt namn: Succisa pratensis");
    expect(gpx).toContain("Antal: 0 plantor/tuvor");
    expect(gpx).toContain("Noggrannhet: 4.2 m");
    expect(gpx).toContain("Med-observatör: Ada; Bo");
    expect(gpx).toContain("<cmt>Fuktig jord &amp; skugga</cmt>");
  });

  it("escapes XML characters and removes invalid XML control characters", () => {
    const gpx = createSurveyGpx(
      { ...survey, title: '"Special" & <test>' },
      [{
        ...observation,
        species: { source: "free-text", enteredName: "Art\u0001 & <namn>" },
      }],
    );

    expect(gpx).toContain("&quot;Special&quot; &amp; &lt;test&gt;");
    expect(gpx).toContain("<name>Art &amp; &lt;namn&gt;</name>");
    expect(gpx).not.toContain("\u0001");
  });

  it("exports a valid empty survey without waypoints", () => {
    const gpx = createSurveyGpx(survey, []);

    expect(gpx).toContain("<metadata><name>Äng &amp; skog</name><desc>En fältinventering</desc></metadata>");
    expect(gpx).not.toContain("<wpt");
    expect(gpx.endsWith("</gpx>")).toBe(true);
  });

  it("rejects invalid WGS84 coordinates", () => {
    const invalidObservation = {
      ...observation,
      position: {
        ...observation.position,
        wgs84: { latitude: 91, longitude: 11.9 },
      },
    };

    expect(() => createSurveyGpx(survey, [invalidObservation])).toThrow(
      "ogiltiga WGS84-koordinater",
    );
  });
});
