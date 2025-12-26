export type Coordinates = {
  lat: number;
  lng: number;
};

/**
 * Geocode an address to coordinates using Google Geocoding API
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  const response = await fetch(url);
  const result = await response.json();

  if (result.status === "OK" && result.results.length > 0) {
    const location = result.results[0].geometry.location;
    return {
      lat: location.lat,
      lng: location.lng,
    } as Coordinates;
  }

  // Attempt 2: Retry with cleaned address (removing units, suites, etc.)
  const cleanedAddress = address
    .replace(/[,]?\s*(?:unit|suite|apt|apartment|room|bldg|building|floor)\s*[\w\d-]+/gi, "")
    .replace(/[,]?\s*#[\w\d-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedAddress !== address && cleanedAddress.length > 5) {
    const cleanedUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanedAddress)}&key=${apiKey}`;
    const cleanedResponse = await fetch(cleanedUrl);
    const cleanedResult = await cleanedResponse.json();

    if (cleanedResult.status === "OK" && cleanedResult.results.length > 0) {
      const location = cleanedResult.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      } as Coordinates;
    }
  }

  return null;
}
