import { useConvexAuth, useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { SFSymbol } from "expo-symbols";
import type { Region } from "react-native-maps";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { JobFilter } from "@shared/jobs/jobsList";
import {
  buildJobPins,
  getFitPoints,
  getNextFitTarget,
  getPinKind,
  getPinZIndex,
} from "@shared/jobs/mapPins";
import type { FitTarget, JobPin, MapPoint } from "@shared/jobs/mapPins";
import { Text } from "@/components/ui/text";
import { toast, toastError } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { openRouteDirections } from "@/lib/directions";
import { describeLocationError, getCurrentLocation, isLocationSettingsError } from "@/lib/location";
import { minTapSize, radius, space } from "@/lib/theme";

import { getPinStyle } from "../lib/jobColors";
import { MapJobSummary } from "./MapJobSummary";

type Job = Doc<"jobs">;

interface JobsMapProps {
  /** The page's status filter; it picks the plain pins. Today's route stops always show. */
  filter: JobFilter;
}

// Dallas, TX when there's nothing better to center on (same as the web map)
const DEFAULT_CENTER: MapPoint = { lat: 32.7767, lng: -96.797 };
// About a neighbourhood across: where "Locate me" and a one-pin fit zoom to
const CLOSE_DELTA = 0.02;
// Room around fitted pins: the controls on the right, the job summary at the bottom
const FIT_PADDING = { top: 64, right: 96, bottom: 64, left: 56 };

const toLatLng = (point: MapPoint) => ({ latitude: point.lat, longitude: point.lng });

function regionAround(point: MapPoint, delta: number): Region {
  return { ...toLatLng(point), latitudeDelta: delta, longitudeDelta: delta };
}

/**
 * Apple Maps with today's route stops (numbered pins) and the jobs matching the filter, his blue
 * location dot and his home. Tapping a pin shows the job with Open and Directions buttons.
 */
export function JobsMap({ filter }: JobsMapProps) {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const args = isAuthenticated ? {} : "skip";
  const filteredJobs = useQuery(api.jobs.list, isAuthenticated ? { status: filter } : "skip");
  const routeJobs = useQuery(api.jobs.getSelectedForRoute, args);
  const currentUser = useQuery(api.users.getCurrentUser, args);

  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  // What the map framed last, so the fit button can switch between the route and all jobs
  const [lastFit, setLastFit] = useState<FitTarget | null>(null);
  // The filter the map last framed, so it frames again when the filter changes
  const fittedFilterRef = useRef<JobFilter | null>(null);
  const userLocationRef = useRef<MapPoint | null>(null);

  const { routePins, otherPins } = buildJobPins(routeJobs ?? [], filteredJobs ?? []);
  const pins: JobPin<Job>[] = [...otherPins, ...routePins];
  const hasRoute = routePins.length > 0;
  const nextFitTarget = getNextFitTarget(lastFit, hasRoute);
  const homeLocation = currentUser?.homeCoordinates;
  const isLoaded = filteredJobs !== undefined && routeJobs !== undefined;
  // Gone once it no longer matches the filter (or was deleted)
  const selectedPin = pins.find((pin) => pin.job._id === selectedJobId);

  const fitTo = (target: FitTarget) => {
    const map = mapRef.current;
    const points = getFitPoints(target, routePins, otherPins);
    setLastFit(target);
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.animateToRegion(regionAround(points[0], CLOSE_DELTA), 400);
      return;
    }
    map.fitToCoordinates(points.map(toLatLng), { edgePadding: FIT_PADDING, animated: true });
  };

  // Show his location dot when he has already allowed it; ask quietly like the web map does
  useEffect(() => {
    getCurrentLocation()
      .then((location) => {
        userLocationRef.current = location;
        setHasLocation(true);
      })
      .catch((error: unknown) => console.log("Jobs map location:", error));
  }, []);

  // Frame today's route (or all pins) once the map and jobs are loaded, like the web map. After
  // he picks another filter, frame all its jobs: that's what he switched to see.
  useEffect(() => {
    if (!isMapReady || !isLoaded || fittedFilterRef.current === filter) return;
    const isFirstFit = fittedFilterRef.current === null;
    fittedFilterRef.current = filter;
    fitTo(isFirstFit ? getNextFitTarget(null, hasRoute) : "all");
  });

  const handleFit = () => {
    if (pins.length === 0) {
      toast.info("No jobs on the map", {
        description: "Jobs show up here once their address is found.",
      });
      return;
    }
    fitTo(nextFitTarget);
  };

  const handleLocateMe = async () => {
    // Go to the last known spot right away while a fresh one comes in
    if (userLocationRef.current) {
      mapRef.current?.animateToRegion(regionAround(userLocationRef.current, CLOSE_DELTA), 300);
    }
    setIsLocating(true);
    try {
      const location = await getCurrentLocation();
      userLocationRef.current = location;
      setHasLocation(true);
      mapRef.current?.animateToRegion(regionAround(location, CLOSE_DELTA), 400);
    } catch (error) {
      console.log("Locate me failed:", error);
      toast.error("Location problem", {
        description: describeLocationError(error),
        action:
          isLocationSettingsError(error) ?
            { label: "Settings", onPress: () => void Linking.openSettings() }
          : undefined,
      });
    } finally {
      setIsLocating(false);
    }
  };

  const handleNavigateRoute = async () => {
    try {
      const isOpened = await openRouteDirections(routeJobs ?? [], homeLocation);
      if (!isOpened) toast.info("No stops on today's route have an address on the map");
    } catch (error) {
      toastError("Couldn't open Google Maps", error);
    }
  };

  // Only read when the map mounts; it frames the pins once they load
  const initialCenter = pins[0]?.position ?? homeLocation;

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.muted }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionAround(initialCenter ?? DEFAULT_CENTER, initialCenter ? 0.3 : 0.6)}
        showsUserLocation={hasLocation}
        showsPointsOfInterests={false}
        showsCompass={false}
        onMapReady={() => setIsMapReady(true)}
        onPress={() => setSelectedJobId(null)}
        accessibilityLabel="Map of your jobs"
      >
        {homeLocation ?
          <Marker
            coordinate={toLatLng(homeLocation)}
            title="Home"
            zIndex={1}
            tracksViewChanges={false}
            accessibilityLabel="Home"
          >
            <View
              style={[
                styles.homePin,
                { backgroundColor: colors.card, borderColor: colors.foreground },
              ]}
            >
              <SymbolView name="house.fill" size={18} tintColor={colors.foreground} />
            </View>
          </Marker>
        : null}

        {pins.map((pin) => (
          <JobMarker
            key={pin.job._id}
            pin={pin}
            isSelected={pin.job._id === selectedJobId}
            onPress={() => setSelectedJobId(pin.job._id)}
          />
        ))}
      </MapView>

      {!isLoaded ?
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" accessibilityLabel="Loading jobs" />
        </View>
      : null}

      <View style={styles.controls}>
        <MapButton
          icon="location.fill"
          label="Go to my location"
          onPress={handleLocateMe}
          isBusy={isLocating}
        />
        <MapButton
          icon={
            nextFitTarget === "route" ?
              "point.topleft.down.to.point.bottomright.curvepath"
            : "arrow.up.left.and.down.right.magnifyingglass"
          }
          label={nextFitTarget === "route" ? "Show today's route" : "Show all jobs on the map"}
          onPress={handleFit}
        />
        {routePins.length > 0 ?
          <MapButton
            icon="car.fill"
            label="Drive today's route in Google Maps"
            onPress={handleNavigateRoute}
            isPrimary
          />
        : null}
      </View>

      {selectedPin ?
        <MapJobSummary
          job={selectedPin.job}
          routeNumber={selectedPin.routeNumber}
          onClose={() => setSelectedJobId(null)}
        />
      : isLoaded && pins.length === 0 ?
        <View style={[styles.emptyNote, { backgroundColor: colors.card }]}>
          <Text variant="label">No {filter} jobs on the map</Text>
          <Text variant="caption" tone="muted">
            Jobs show up here once their address is found.
          </Text>
        </View>
      : null}
    </View>
  );
}

interface JobMarkerProps {
  pin: JobPin<Job>;
  isSelected: boolean;
  onPress: () => void;
}

function JobMarker({ pin, isSelected, onPress }: JobMarkerProps) {
  const { colors } = useTheme();
  const kind = getPinKind(pin);
  const style = getPinStyle(kind, colors);
  const isRoute = kind === "route";
  const size = (isRoute ? 44 : 32) * (isSelected ? 1.25 : 1);

  return (
    <Marker
      coordinate={toLatLng(pin.position)}
      zIndex={isSelected ? 2000 : getPinZIndex(pin)}
      onPress={onPress}
      stopPropagation
      accessibilityLabel={
        isRoute ? `Stop ${pin.routeNumber}, ${pin.job.address}` : `${pin.job.address}, ${kind}`
      }
    >
      {/* 48 pt tap area around every pin */}
      <View style={styles.pinHitArea}>
        <View
          style={[
            styles.pin,
            {
              width: size,
              height: size,
              backgroundColor: style.background,
              borderColor: isSelected ? colors.foreground : "#ffffff",
            },
          ]}
        >
          {isRoute ?
            <Text variant="label" maxFontSizeMultiplier={1} style={styles.pinNumber}>
              {pin.routeNumber}
            </Text>
          : style.symbol ?
            <SymbolView name={style.symbol} size={15} weight="heavy" tintColor="#ffffff" />
          : null}
        </View>
      </View>
    </Marker>
  );
}

interface MapButtonProps {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
  isBusy?: boolean;
}

function MapButton({ icon, label, onPress, isPrimary, isBusy }: MapButtonProps) {
  const { colors } = useTheme();
  const tint = isPrimary ? colors.primaryForeground : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: isBusy }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mapButton,
        {
          backgroundColor: isPrimary ? colors.primary : colors.card,
          borderColor: isPrimary ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {isBusy ?
        <ActivityIndicator color={tint} />
      : <SymbolView name={icon} size={20} weight="semibold" tintColor={tint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
  },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  controls: { position: "absolute", top: space.md, right: space.md, gap: space.md },
  mapButton: {
    width: minTapSize,
    height: minTapSize,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  homePin: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pinHitArea: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  pin: {
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pinNumber: { color: "#ffffff", fontWeight: "700" },
  emptyNote: {
    position: "absolute",
    left: space.md,
    right: space.md,
    bottom: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    gap: space.xs,
  },
});
