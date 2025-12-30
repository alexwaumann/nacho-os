import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { Coordinates, RouteWaypoint } from "@/server/geo";
import { calculateRouteMetrics, geocodeAddress, optimizeRoute } from "@/server/geo";

type Job = Doc<"jobs">;

export function useRouteOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);

  const batchUpdateRouteSelection = useMutation(api.jobs.batchUpdateRouteSelection);
  const batchUpdateRouteMetrics = useMutation(api.jobs.batchUpdateRouteMetrics);
  const updateRouteTotals = useMutation(api.jobs.updateRouteTotals);
  const deleteRouteTotals = useMutation(api.jobs.deleteRouteTotals);
  const updateRouteOrder = useMutation(api.jobs.updateRouteOrder);
  const clearRoute = useMutation(api.jobs.clearRoute);
  const updateJob = useMutation(api.jobs.update);

  const allPendingJobs = useQuery(api.jobs.list, { status: "pending" }) ?? [];
  const currentUser = useQuery(api.users.getCurrentUser);

  const getCurrentLocation = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      // Check for geolocation support (defensive check for older browsers/environments)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          let message = "Unable to get your location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "Location access denied. Please enable location permissions.";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              message = "Location request timed out.";
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      );
    });
  }, []);

  const optimizeAndSaveRoute = useCallback(
    async (selectedJobIds: Array<Id<"jobs">>) => {
      setIsOptimizing(true);
      console.log("optimizing...");

      try {
        // Check if we have pending jobs data loaded
        if (allPendingJobs.length === 0 && selectedJobIds.length > 0) {
          toast.error("Unable to optimize route", {
            description: "Job data is still loading. Please try again.",
          });
          setIsOptimizing(false);
          return true; // Return true to close modal anyway
        }

        // Get current location (required - used as both origin and destination)
        let currentLocation: Coordinates;
        try {
          currentLocation = await getCurrentLocation();
        } catch (locationError) {
          toast.error("Location Required", {
            description:
              locationError instanceof Error ? locationError.message : "Unable to access location",
          });
          setIsOptimizing(false);
          return true; // Return true to close modal anyway
        }

        console.log("found location");

        // Get the selected jobs
        const selectedJobs = allPendingJobs.filter((job) => selectedJobIds.includes(job._id));

        // Identify jobs missing coordinates and geocode them
        const jobsWithoutCoords = selectedJobs.filter((job) => !job.coordinates);

        if (jobsWithoutCoords.length > 0) {
          // Geocode all missing addresses in parallel
          const geocodeResults = await Promise.all(
            jobsWithoutCoords.map(async (job) => {
              try {
                const coordinates = await geocodeAddress({ data: { address: job.address } });
                return { job, coordinates, error: null };
              } catch (error) {
                return { job, coordinates: null, error };
              }
            }),
          );

          // Check for any failures
          const failedGeocode = geocodeResults.filter((r) => !r.coordinates);

          if (failedGeocode.length > 0) {
            const failedAddresses = failedGeocode.map((r) => r.job.address);
            toast.error("Failed to find coordinates", {
              description: `Could not geocode the following address${failedAddresses.length > 1 ? "es" : ""}: ${failedAddresses.join(", ")}. Please edit the job site address for ${failedAddresses.length > 1 ? "these jobs" : "this job"}.`,
              duration: 10000,
            });
            setIsOptimizing(false);
            return false;
          }

          // Update jobs in Convex with new coordinates
          await Promise.all(
            geocodeResults
              .filter((r) => r.coordinates)
              .map((r) =>
                updateJob({
                  jobId: r.job._id,
                  coordinates: r.coordinates!,
                }),
              ),
          );

          // Update local job references with new coordinates for route calculation
          for (const result of geocodeResults) {
            if (result.coordinates) {
              const job = selectedJobs.find((j) => j._id === result.job._id);
              if (job) {
                (job as { coordinates?: Coordinates }).coordinates = result.coordinates;
              }
            }
          }
        }

        // Now all selected jobs should have coordinates
        const jobsWithCoords = selectedJobs.filter((job) => job.coordinates);
        console.log("jobsWithCoords", jobsWithCoords);

        // Build deselection updates for jobs no longer selected
        const deselectedJobIds = allPendingJobs
          .filter((job) => job.selectedForRoute && !selectedJobIds.includes(job._id))
          .map((job) => job._id);

        // If less than 1 job with coordinates, just update selection without route optimization
        if (jobsWithCoords.length < 1) {
          // Update selections
          const selections = [
            ...selectedJobIds.map((jobId, index) => ({
              jobId,
              selected: true,
              routeOrder: index,
            })),
            ...deselectedJobIds.map((jobId) => ({
              jobId,
              selected: false,
              routeOrder: undefined,
            })),
          ];

          await batchUpdateRouteSelection({ selections });

          // Delete route totals since we can't calculate without 1+ stops with coordinates
          // Note: We only delete totals, not clear all selections (that's already done above)
          await deleteRouteTotals();

          toast.success(
            selectedJobIds.length === 0 ?
              "Route cleared"
            : `${selectedJobIds.length} stop${selectedJobIds.length === 1 ? "" : "s"} selected`,
          );

          setIsOptimizing(false);
          return true;
        }

        // Build waypoints for route optimization
        const waypoints: Array<RouteWaypoint> = jobsWithCoords.map((job) => ({
          coordinates: job.coordinates!,
          address: job.address,
        }));

        // Determine destination: use home address if set, otherwise use current location (round trip)
        const destination = currentUser?.homeCoordinates ?? currentLocation;

        // Call Google Routes API to optimize
        const routeResult = await optimizeRoute({
          data: {
            origin: currentLocation,
            destination,
            waypoints,
            optimize: true,
          },
        });

        console.log("routeResult", routeResult);

        if (!routeResult) {
          toast.error("Route optimization failed", {
            description: "Unable to calculate optimal route. Please try again.",
          });
          setIsOptimizing(false);
          return false;
        }

        // Map optimized order back to job IDs
        const orderedJobIds = routeResult.waypointOrder.map(
          (originalIndex: number) => jobsWithCoords[originalIndex]._id,
        );

        // Build selection updates with optimized order
        const selections = [
          ...orderedJobIds.map((jobId: Id<"jobs">, index: number) => ({
            jobId,
            selected: true,
            routeOrder: index,
          })),
          ...deselectedJobIds.map((jobId) => ({
            jobId,
            selected: false,
            routeOrder: undefined,
          })),
        ];

        await batchUpdateRouteSelection({ selections });

        // Build metrics updates for each job
        const metricsUpdates = orderedJobIds.map((jobId: Id<"jobs">, index: number) => ({
          jobId,
          routeOrder: index,
          // Metrics from current leg (travel TO this stop)
          travelTime: routeResult.metrics[index]?.duration,
          distance: routeResult.metrics[index]?.distance,
          travelTimeValue: routeResult.metrics[index]?.durationValue,
          distanceValue: routeResult.metrics[index]?.distanceValue,
        }));

        await batchUpdateRouteMetrics({ updates: metricsUpdates });

        // Save route totals
        await updateRouteTotals({
          totalDistance: routeResult.totalDistance,
          totalDuration: routeResult.totalDuration,
          totalDistanceValue: routeResult.metrics.reduce(
            (sum: number, m: { distanceValue: number }) => sum + m.distanceValue,
            0,
          ),
          totalDurationValue: routeResult.metrics.reduce(
            (sum: number, m: { durationValue: number }) => sum + m.durationValue,
            0,
          ),
        });

        toast.success("Route optimized", {
          description: `${orderedJobIds.length} stops, ${routeResult.totalDistance}, ${routeResult.totalDuration}`,
        });

        setIsOptimizing(false);
        return true;
      } catch (error) {
        console.error("Route optimization error:", error);
        toast.error("Failed to optimize route", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        });
        setIsOptimizing(false);
        return false;
      }
    },
    [
      allPendingJobs,
      currentUser?.homeCoordinates,
      getCurrentLocation,
      batchUpdateRouteSelection,
      batchUpdateRouteMetrics,
      updateRouteTotals,
      deleteRouteTotals,
      updateJob,
    ],
  );

  const recalculateRouteMetrics = useCallback(
    async (orderedJobIds: Array<Id<"jobs">>) => {
      if (orderedJobIds.length < 2) {
        return;
      }

      setIsOptimizing(true);

      try {
        // Get current location
        let currentLocation: Coordinates;
        try {
          currentLocation = await getCurrentLocation();
        } catch (locationError) {
          toast.error("Location Required", {
            description:
              locationError instanceof Error ? locationError.message : "Unable to access location",
          });
          setIsOptimizing(false);
          return;
        }

        // Get jobs in the new order
        const orderedJobs = orderedJobIds
          .map((id) => allPendingJobs.find((job) => job._id === id))
          .filter((job): job is Job => job !== undefined);

        if (orderedJobs.length < 2) {
          setIsOptimizing(false);
          return;
        }

        // Identify jobs missing coordinates and geocode them
        const jobsWithoutCoords = orderedJobs.filter((job) => !job.coordinates);

        if (jobsWithoutCoords.length > 0) {
          // Geocode all missing addresses in parallel
          const geocodeResults = await Promise.all(
            jobsWithoutCoords.map(async (job) => {
              try {
                const coordinates = await geocodeAddress({ data: { address: job.address } });
                return { job, coordinates, error: null };
              } catch (error) {
                return { job, coordinates: null, error };
              }
            }),
          );

          // Check for any failures
          const failedGeocode = geocodeResults.filter((r) => !r.coordinates);

          if (failedGeocode.length > 0) {
            const failedAddresses = failedGeocode.map((r) => r.job.address);
            toast.error("Failed to find coordinates", {
              description: `Could not geocode the following address${failedAddresses.length > 1 ? "es" : ""}: ${failedAddresses.join(", ")}. Please edit the job site address for ${failedAddresses.length > 1 ? "these jobs" : "this job"}.`,
              duration: 10000,
            });
            setIsOptimizing(false);
            return;
          }

          // Update jobs in Convex with new coordinates
          await Promise.all(
            geocodeResults
              .filter((r) => r.coordinates)
              .map((r) =>
                updateJob({
                  jobId: r.job._id,
                  coordinates: r.coordinates!,
                }),
              ),
          );

          // Update local job references with new coordinates for route calculation
          for (const result of geocodeResults) {
            if (result.coordinates) {
              const job = orderedJobs.find((j) => j._id === result.job._id);
              if (job) {
                (job as { coordinates?: Coordinates }).coordinates = result.coordinates;
              }
            }
          }
        }

        // Now all jobs should have coordinates
        const jobsWithCoords = orderedJobs.filter((job) => job.coordinates);

        if (jobsWithCoords.length < 2) {
          setIsOptimizing(false);
          return;
        }

        // Build waypoints in the manual order (no optimization)
        const waypoints: Array<RouteWaypoint> = jobsWithCoords.map((job) => ({
          coordinates: job.coordinates!,
          address: job.address,
        }));

        // Call route metrics calculation with home address as destination (if set)
        const routeResult = await calculateRouteMetrics({
          data: {
            origin: currentLocation,
            waypoints,
            destination: currentUser?.homeCoordinates,
          },
        });

        if (!routeResult) {
          toast.error("Failed to calculate route metrics");
          setIsOptimizing(false);
          return;
        }

        // Update route order in database
        await updateRouteOrder({ orderedJobIds });

        // Update metrics for each job
        const metricsUpdates = orderedJobIds.map((jobId, index) => ({
          jobId,
          routeOrder: index,
          travelTime: routeResult.metrics[index]?.duration,
          distance: routeResult.metrics[index]?.distance,
          travelTimeValue: routeResult.metrics[index]?.durationValue,
          distanceValue: routeResult.metrics[index]?.distanceValue,
        }));

        await batchUpdateRouteMetrics({ updates: metricsUpdates });

        // Update route totals
        await updateRouteTotals({
          totalDistance: routeResult.totalDistance,
          totalDuration: routeResult.totalDuration,
          totalDistanceValue: routeResult.totalDistanceValue,
          totalDurationValue: routeResult.totalDurationValue,
        });

        toast.success("Route updated");
      } catch (error) {
        console.error("Route recalculation error:", error);
        toast.error("Failed to recalculate route");
      } finally {
        setIsOptimizing(false);
      }
    },
    [
      allPendingJobs,
      currentUser?.homeCoordinates,
      getCurrentLocation,
      updateRouteOrder,
      batchUpdateRouteMetrics,
      updateRouteTotals,
      updateJob,
    ],
  );

  const handleClearRoute = useCallback(async () => {
    try {
      await clearRoute();
      toast.success("Route cleared");
    } catch (error) {
      console.error("Clear route error:", error);
      toast.error("Failed to clear route");
    }
  }, [clearRoute]);

  return {
    isOptimizing,
    optimizeAndSaveRoute,
    recalculateRouteMetrics,
    clearRoute: handleClearRoute,
  };
}
