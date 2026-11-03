import { useAction } from "convex/react";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import type { Coordinates, PlaceSuggestion } from "@convex/lib/routing";

// Wait for a pause in typing before asking Google (each request costs money), like the web
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Address suggestions for what he has typed, from Google Places through Convex, biased towards
 * `near` (his home, like the web; else where the phone is, if location is already allowed).
 * Only the newest search's answer is shown.
 */
export function usePlaceSuggestions(query: string, near: Coordinates | undefined) {
  const getPlaceSuggestions = useAction(api.maps.getPlaceSuggestions);
  const fallbackBias = useLastKnownLocation(!near);
  // Compared by value, so a new object for the same point doesn't search again
  const biasLat = (near ?? fallbackBias)?.lat;
  const biasLng = (near ?? fallbackBias)?.lng;

  // The newest answer, and which search it answers
  const [result, setResult] = useState<{
    key: string;
    suggestions: PlaceSuggestion[];
    hasError: boolean;
  }>();

  const trimmed = query.trim();
  const isSearchable = trimmed.length >= MIN_QUERY_LENGTH;
  const searchKey = `${trimmed}|${biasLat}|${biasLng}`;

  useEffect(() => {
    if (!isSearchable) return;

    let isCurrent = true;
    const userCoordinates =
      biasLat !== undefined && biasLng !== undefined ? { lat: biasLat, lng: biasLng } : undefined;
    const timeout = setTimeout(() => {
      getPlaceSuggestions({ query: trimmed, userCoordinates })
        .then((suggestions) => {
          if (isCurrent) setResult({ key: searchKey, suggestions, hasError: false });
        })
        .catch((error: unknown) => {
          console.log("Address suggestions failed:", error);
          if (isCurrent) setResult({ key: searchKey, suggestions: [], hasError: true });
        });
    }, DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [searchKey, trimmed, isSearchable, biasLat, biasLng, getPlaceSuggestions]);

  // While a new search runs, the last list stays up (like the web) instead of flickering away
  const isSearching = isSearchable && result?.key !== searchKey;
  const suggestions = isSearchable ? (result?.suggestions ?? []) : [];
  const hasError = isSearchable && !isSearching && !!result?.hasError;

  return { suggestions, isSearching, hasError, isSearchable };
}

/** Where the phone last was, without asking for permission (undefined if not allowed) */
function useLastKnownLocation(isNeeded: boolean): Coordinates | undefined {
  const [coordinates, setCoordinates] = useState<Coordinates>();

  useEffect(() => {
    if (!isNeeded) return;
    let isCurrent = true;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return;
      const position = await Location.getLastKnownPositionAsync();
      if (position && isCurrent) {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      }
    })().catch((error: unknown) => console.warn("Reading the last location failed:", error));
    return () => {
      isCurrent = false;
    };
  }, [isNeeded]);

  return coordinates;
}
