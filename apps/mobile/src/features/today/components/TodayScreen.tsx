import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { Doc, Id } from "@convex/_generated/dataModel";
import { hasOrderChanged, moveInOrder } from "@shared/jobs/routePlan";
import { isRouteDone, isStopDone } from "@shared/jobs/today";
import { Text } from "@/components/ui/text";
import { toast, toastError } from "@/components/ui/toast";
import { useRemoveRouteStop } from "@/features/route/hooks/useRemoveRouteStop";
import { useRouteBrief } from "@/features/route/hooks/useRouteBrief";
import { useRouteOptimization } from "@/features/route/hooks/useRouteOptimization";
import { useRouteOrder } from "@/features/route/hooks/useRouteOrder";
import { useTodayRoute } from "@/features/route/hooks/useTodayRoute";
import { useTheme } from "@/hooks/useTheme";
import { openDirectionsTo, openRouteDirections } from "@/lib/directions";
import { space } from "@/lib/theme";

import { useIsLargeText } from "../hooks/useIsLargeText";
import { ActionButton } from "./ActionButton";
import { AllStopsDoneCard } from "./AllStopsDoneCard";
import { EmptyRouteCard } from "./EmptyRouteCard";
import { HomeRouteCard } from "./HomeRouteCard";
import { RouteBriefCard } from "./RouteBriefCard";
import { RouteStopCard } from "./RouteStopCard";
import { RouteSummaryCard } from "./RouteSummaryCard";
import { TodayActions } from "./TodayActions";
import { WorkOrderQueue } from "./WorkOrderQueue";

type Job = Doc<"jobs">;
type JobId = Id<"jobs">;

const showComingSoon = () => toast.info("Coming soon");

/**
 * Today: the action buttons, the weather brief, and today's route in order (drag to reorder,
 * swipe to remove, tap to open), ending with the drive home. A port of the web Today page.
 */
export function TodayScreen() {
  const { colors } = useTheme();
  const isLargeText = useIsLargeText();
  const { stops, totals, homeCoordinates, homeLegSeconds, isLoaded } = useTodayRoute();
  const { orderedJobs, setOrder, getOrder } = useRouteOrder(stops);
  const { isOptimizing, recalculateRouteMetrics, clearRoute } = useRouteOptimization();
  const routeBrief = useRouteBrief({
    jobs: stops ?? [],
    homeCoordinates,
    homeLegSeconds,
    recalculateRouteMetrics,
  });
  const { removeStop } = useRemoveRouteStop({ getOrder, setOrder, recalculateRouteMetrics });

  const pendingStops = orderedJobs.filter((job) => !isStopDone(job));
  const isAllDone = isRouteDone(orderedJobs);
  const hasRoute = (stops?.length ?? 0) > 0;
  const serverOrder = (stops ?? []).map((job) => job._id);

  const handleOpenJob = (id: JobId) => {
    router.push({ pathname: "/job/[id]", params: { id } });
  };

  const handleEditRoute = () => {
    router.push("/edit-route");
  };

  const handleClearRoute = () => {
    Alert.alert("Clear today's route?", "The jobs stay in your job list.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear route", style: "destructive", onPress: () => void clearRoute() },
    ]);
  };

  const handleNavigateRoute = async () => {
    try {
      // Only the stops still to do; done stops are skipped
      const isOpened = await openRouteDirections(pendingStops, homeCoordinates);
      if (!isOpened) {
        toast.error("Can't open directions", {
          description: "None of the stops has a map location yet. Plan the route first.",
        });
      }
    } catch (error) {
      toastError("Couldn't open Google Maps", error);
    }
  };

  const handleDirections = async (job: Job) => {
    try {
      await openDirectionsTo(job.address);
    } catch (error) {
      toastError("Couldn't open Google Maps", error);
    }
  };

  const handleNewOrder = (order: JobId[]) => {
    setOrder(order);
    if (hasOrderChanged(order, serverOrder)) void recalculateRouteMetrics(order);
  };

  const handleMove = (from: number, to: number) => {
    handleNewOrder(moveInOrder(getOrder(), from, to));
  };

  const handleDragBegin = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const renderStop = ({ item, drag, isActive, getIndex }: RenderItemParams<Job>) => {
    const index = getIndex() ?? 0;
    const isDone = isStopDone(item);
    return (
      <ScaleDecorator activeScale={1.03}>
        <View style={styles.cell}>
          <RouteStopCard
            job={item}
            stopNumber={index + 1}
            isDone={isDone}
            arrivalTime={isDone ? undefined : routeBrief.arrivalTimes[item._id]}
            weatherNote={routeBrief.siteNotes[item._id]}
            isDragging={isActive}
            onOpen={() => handleOpenJob(item._id)}
            onDirections={() => void handleDirections(item)}
            onRemove={() => void removeStop(item)}
            onDrag={drag}
            onMoveUp={index > 0 ? () => handleMove(index, index - 1) : undefined}
            onMoveDown={
              index < orderedJobs.length - 1 ? () => handleMove(index, index + 1) : undefined
            }
          />
        </View>
      </ScaleDecorator>
    );
  };

  const header = (
    <View style={styles.header}>
      <TodayActions
        onAddJob={showComingSoon}
        onScanReceipt={showComingSoon}
        onScanCheck={showComingSoon}
      />

      <WorkOrderQueue />

      <RouteBriefCard routeBrief={routeBrief} />

      {/* Wait for the route before choosing between the empty state and the stops */}
      {!isLoaded ?
        <ActivityIndicator size="large" accessibilityLabel="Loading today's route" />
      : !hasRoute ?
        <EmptyRouteCard onPlanRoute={handleEditRoute} onOpenJob={handleOpenJob} />
      : <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text variant="heading" style={styles.flex}>
              Today&apos;s route
            </Text>
            {isOptimizing ?
              <ActivityIndicator color={colors.primary} accessibilityLabel="Updating the route" />
            : null}
          </View>
          <View style={[styles.buttonRow, isLargeText && styles.buttonColumn]}>
            <ActionButton
              title="Edit route"
              icon="pencil"
              onPress={handleEditRoute}
              style={isLargeText ? undefined : styles.flex}
            />
            <ActionButton
              title="Clear route"
              icon="xmark"
              variant="destructive"
              onPress={handleClearRoute}
              style={isLargeText ? undefined : styles.flex}
            />
          </View>

          {totals && orderedJobs.length >= 2 ?
            <RouteSummaryCard
              totalDistance={totals.totalDistance}
              totalDuration={totals.totalDuration}
            />
          : null}

          {pendingStops.length >= 2 ?
            <ActionButton
              title="Navigate whole route"
              icon="location.fill"
              variant="primary"
              onPress={() => void handleNavigateRoute()}
            />
          : null}

          {isAllDone ?
            <AllStopsDoneCard onPlanTomorrow={handleEditRoute} />
          : null}

          {orderedJobs.length >= 2 ?
            <Text variant="caption" tone="muted">
              Hold a stop to move it. Swipe left to remove it.
            </Text>
          : null}
        </View>
      }
    </View>
  );

  // The ride home: always last, never moved, nothing to open
  const footer =
    orderedJobs.length > 0 && homeCoordinates ?
      <HomeRouteCard
        homeCoordinates={homeCoordinates}
        driveSeconds={homeLegSeconds}
        arrivalTime={isAllDone ? undefined : routeBrief.homeArrivalTime}
      />
    : undefined;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <DraggableFlatList
        data={orderedJobs}
        keyExtractor={(job) => job._id}
        renderItem={renderStop}
        onDragBegin={handleDragBegin}
        onDragEnd={({ data }) => handleNewOrder(data.map((job) => job._id))}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentInsetAdjustmentBehavior="automatic"
        containerStyle={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.lg, paddingBottom: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  buttonRow: { flexDirection: "row", gap: space.md },
  buttonColumn: { flexDirection: "column" },
  cell: { paddingBottom: space.md },
});
