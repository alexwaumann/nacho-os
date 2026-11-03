import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { Coordinates, RouteWaypoint } from "@convex/lib/routing";
import {
  buildRouteLegUpdates,
  buildRouteSelections,
  describeGeocodeFailure,
  getDeselectedIds,
  sumRouteLegs,
} from "@shared/jobs/routePlan";
import { toast, toastError } from "@/components/ui/toast";
import { describeLocationError, getCurrentLocation, isLocationSettingsError } from "@/lib/location";

type Job = Doc<"jobs">;
type JobId = Id<"jobs">;

export interface RecalculateOptions {
  /** Skip the "Route updated" toast, e.g. when another toast (with Undo) is already showing */
  quiet?: boolean;
}

/** A failure with a message that's already in plain words, shown as is */
class RouteProblem extends Error {
  title: string;
  showSettings: boolean;

  constructor(title: string, message: string, showSettings = false) {
    super(message);
    this.title = title;
    this.showSettings = showSettings;
  }
}

function showProblem(error: unknown, fallbackTitle: string) {
  if (error instanceof RouteProblem) {
    toast.error(error.title, {
      description: error.message,
      duration: 10_000,
      action:
        error.showSettings ?
          { label: "Settings", onPress: () => void Linking.openSettings() }
        : undefined,
    });
    return;
  }
  toastError(fallbackTitle, error);
}

async function locate(): Promise<Coordinates> {
  try {
    return await getCurrentLocation();
  } catch (error) {
    throw new RouteProblem(
      "Can't find where you are",
      describeLocationError(error),
      isLocationSettingsError(error),
    );
  }
}

/**
 * Plans and saves today's route, like the web app's hook of the same name:
 * - `optimizeAndSaveRoute(ids)`: puts exactly these jobs on the route in the fastest order, from
 *   where he is now to home (or back to where he is when no home is set)
 * - `recalculateRouteMetrics(ids)`: keeps his order and refreshes the drive times and totals
 * - `clearRoute()`: takes every job off the route
 * Shows toasts for the outcome. No UI, so the voice assistant can use it too.
 */
export function useRouteOptimization() {
  const { isAuthenticated } = useConvexAuth();
  const [isOptimizing, setIsOptimizing] = useState(false);

  const geocodeAddress = useAction(api.maps.geocodeAddress);
  const optimizeRoute = useAction(api.maps.optimizeRoute);
  const calculateRouteMetrics = useAction(api.maps.calculateRouteMetrics);
  const batchUpdateRouteSelection = useMutation(api.jobs.batchUpdateRouteSelection);
  const batchUpdateRouteMetrics = useMutation(api.jobs.batchUpdateRouteMetrics);
  const updateRouteTotals = useMutation(api.jobs.updateRouteTotals);
  const deleteRouteTotals = useMutation(api.jobs.deleteRouteTotals);
  const updateRouteOrder = useMutation(api.jobs.updateRouteOrder);
  const clearRouteMutation = useMutation(api.jobs.clearRoute);
  const updateJob = useMutation(api.jobs.update);

  const pendingJobs = useQuery(api.jobs.list, isAuthenticated ? { status: "pending" } : "skip");
  const currentUser = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const homeCoordinates = currentUser?.homeCoordinates;

  // Read inside the callbacks, so a slow route change always sees the latest jobs
  const pendingJobsRef = useRef(pendingJobs);
  useEffect(() => {
    pendingJobsRef.current = pendingJobs;
  }, [pendingJobs]);

  /** The jobs with coordinates, looking up (and saving) any that are missing */
  const withCoordinates = useCallback(
    async (jobs: Job[]): Promise<(Job & { coordinates: Coordinates })[]> => {
      const results = await Promise.all(
        jobs.map(async (job) => {
          if (job.coordinates) return { job, coordinates: job.coordinates };
          try {
            const coordinates = await geocodeAddress({ address: job.address });
            if (coordinates) await updateJob({ jobId: job._id, coordinates });
            return { job, coordinates };
          } catch (error) {
            console.log(`Geocoding ${job.address} failed:`, error);
            return { job, coordinates: null };
          }
        }),
      );

      const missing = results.filter((result) => !result.coordinates);
      if (missing.length > 0) {
        throw new RouteProblem(
          "Couldn't find an address",
          describeGeocodeFailure(missing.map((result) => result.job.address)),
        );
      }
      return results.map(({ job, coordinates }) => ({ ...job, coordinates: coordinates! }));
    },
    [geocodeAddress, updateJob],
  );

  const optimizeAndSaveRoute = useCallback(
    async (selectedJobIds: JobId[]): Promise<boolean> => {
      const allPending = pendingJobsRef.current;
      if (allPending === undefined) {
        toast.error("Still loading your jobs", { description: "Try again in a moment." });
        return false;
      }

      setIsOptimizing(true);
      try {
        const deselectedIds = getDeselectedIds(allPending, selectedJobIds);

        // Nothing picked: just take everything off the route
        if (selectedJobIds.length === 0) {
          await batchUpdateRouteSelection({ selections: buildRouteSelections([], deselectedIds) });
          await deleteRouteTotals();
          toast.success("Route cleared");
          return true;
        }

        const origin = await locate();
        const selectedJobs = allPending.filter((job) => selectedJobIds.includes(job._id));
        const sites = await withCoordinates(selectedJobs);
        const waypoints: RouteWaypoint[] = sites.map((job) => ({
          coordinates: job.coordinates,
          address: job.address,
        }));

        // Ends at home when it's set, otherwise loops back to where he is now
        const result = await optimizeRoute({
          origin,
          destination: homeCoordinates ?? origin,
          waypoints,
          optimize: true,
        });
        if (!result) {
          throw new RouteProblem("Couldn't plan the route", "Please try again in a moment.");
        }

        const orderedIds = result.waypointOrder.map((index) => sites[index]._id);
        await batchUpdateRouteSelection({
          selections: buildRouteSelections(orderedIds, deselectedIds),
        });
        await batchUpdateRouteMetrics({
          updates: buildRouteLegUpdates(orderedIds, result.metrics),
        });

        const sums = sumRouteLegs(result.metrics);
        await updateRouteTotals({
          totalDistance: result.totalDistance,
          totalDuration: result.totalDuration,
          totalDistanceValue: sums.distanceValue,
          totalDurationValue: sums.durationValue,
          // The last leg is the drive home, but only when the route really ends there
          homeLeg: homeCoordinates ? result.metrics[orderedIds.length] : undefined,
        });

        const stopCount = `${orderedIds.length} stop${orderedIds.length === 1 ? "" : "s"}`;
        toast.success("Route planned", {
          description: `${stopCount}, ${result.totalDistance}, ${result.totalDuration}`,
        });
        return true;
      } catch (error) {
        showProblem(error, "Couldn't plan the route");
        return false;
      } finally {
        setIsOptimizing(false);
      }
    },
    [
      homeCoordinates,
      withCoordinates,
      optimizeRoute,
      batchUpdateRouteSelection,
      batchUpdateRouteMetrics,
      updateRouteTotals,
      deleteRouteTotals,
    ],
  );

  const recalculateRouteMetrics = useCallback(
    async (orderedJobIds: JobId[], options?: RecalculateOptions): Promise<void> => {
      // One stop still has a drive there and a drive back home
      if (orderedJobIds.length < 1) return;

      setIsOptimizing(true);
      try {
        const allPending = pendingJobsRef.current ?? [];
        const jobs = orderedJobIds.flatMap((id) => {
          const job = allPending.find((pending) => pending._id === id);
          return job ? [job] : [];
        });
        if (jobs.length < 1) return;

        const origin = await locate();
        const sites = await withCoordinates(jobs);
        const result = await calculateRouteMetrics({
          origin,
          waypoints: sites.map((job) => ({ coordinates: job.coordinates, address: job.address })),
          destination: homeCoordinates,
        });
        if (!result) {
          throw new RouteProblem("Couldn't update the drive times", "Please try again.");
        }

        await updateRouteOrder({ orderedJobIds });
        await batchUpdateRouteMetrics({
          updates: buildRouteLegUpdates(orderedJobIds, result.metrics),
        });
        await updateRouteTotals({
          totalDistance: result.totalDistance,
          totalDuration: result.totalDuration,
          totalDistanceValue: result.totalDistanceValue,
          totalDurationValue: result.totalDurationValue,
          homeLeg: result.homeLeg,
        });

        if (!options?.quiet) toast.success("Route updated");
      } catch (error) {
        showProblem(error, "Couldn't update the drive times");
      } finally {
        setIsOptimizing(false);
      }
    },
    [
      homeCoordinates,
      withCoordinates,
      calculateRouteMetrics,
      updateRouteOrder,
      batchUpdateRouteMetrics,
      updateRouteTotals,
    ],
  );

  const clearRoute = useCallback(async (): Promise<boolean> => {
    try {
      await clearRouteMutation();
      toast.success("Route cleared", { description: "The jobs are still in your job list." });
      return true;
    } catch (error) {
      toastError("Couldn't clear the route", error);
      return false;
    }
  }, [clearRouteMutation]);

  return {
    isOptimizing,
    /** False until his open jobs have loaded */
    isReady: pendingJobs !== undefined,
    optimizeAndSaveRoute,
    recalculateRouteMetrics,
    clearRoute,
  };
}
