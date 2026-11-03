import { describe, expect, it } from "vitest";

import { generateGoogleMapsDirectionsUrl, generateGoogleMapsUrl } from "./googleMaps";

const a = { coordinates: { lat: 1, lng: 2 } };
const b = { coordinates: { lat: 3, lng: 4 } };
const c = { coordinates: { lat: 5, lng: 6 } };
const home = { lat: 9, lng: 9 };
const base = "https://www.google.com/maps/dir/?api=1";

describe("generateGoogleMapsUrl", () => {
  it("returns null without any stop that has coordinates", () => {
    expect(generateGoogleMapsUrl([])).toBeNull();
    expect(generateGoogleMapsUrl([{ coordinates: undefined }])).toBeNull();
  });

  it("drives from the current location to the last stop", () => {
    expect(generateGoogleMapsUrl([a, b, c])).toBe(
      `${base}&destination=5,6&travelmode=driving&waypoints=1,2|3,4`,
    );
  });

  it("ends at home with every stop as a waypoint", () => {
    expect(generateGoogleMapsUrl([a, b], true, home)).toBe(
      `${base}&destination=9,9&travelmode=driving&waypoints=1,2|3,4`,
    );
  });

  it("starts at the first stop when not using the current location", () => {
    expect(generateGoogleMapsUrl([a, b, c], false)).toBe(
      `${base}&destination=5,6&travelmode=driving&origin=1,2&waypoints=3,4`,
    );
    expect(generateGoogleMapsUrl([a, b], false, home)).toBe(
      `${base}&destination=9,9&travelmode=driving&origin=1,2&waypoints=3,4`,
    );
  });
});

describe("generateGoogleMapsDirectionsUrl", () => {
  it("encodes the address as the destination", () => {
    expect(generateGoogleMapsDirectionsUrl("928 Burgan St, Waco, TX 76704")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=928%20Burgan%20St%2C%20Waco%2C%20TX%2076704&travelmode=driving",
    );
  });
});
