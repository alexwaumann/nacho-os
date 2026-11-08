import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import ReanimatedSwipeable, {
  SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";
import type { ColorScheme } from "@/lib/theme";
import { minTapSize, radius, space } from "@/lib/theme";

// How wide a revealed action is, and the gap between it and the row
const ACTION_WIDTH = 132;
const ACTION_GAP = space.sm;
// Let go past half the button and it stays open (else it closes)
const OPEN_THRESHOLD = ACTION_WIDTH / 2;
// Slide the row this far across (or at least a bit past the button) to run the action outright.
// The finger travels FRICTION times as far: about 60% of the screen, like Mail.
const FULL_SWIPE_FRACTION = 0.42;
const FULL_SWIPE_MIN = ACTION_WIDTH + ACTION_GAP + 16;
// How much slower than the finger the row moves, like iOS lists
const FRICTION = 1.5;

export interface SwipeAction {
  label: string;
  icon: SFSymbol;
  /** The button's background; the icon and label are white. See `useSwipeColors()`. */
  color: string;
  onPress: () => void;
  /** Read by VoiceOver on the revealed button; the label if missing */
  accessibilityLabel?: string;
  /**
   * Swiping far past the button runs the action without a tap, like Mail. Default true; turn it
   * off where one long swipe shouldn't do it.
   */
  isFullSwipe?: boolean;
}

type Side = "left" | "right";

interface SwipeableRowProps {
  /** Revealed by swiping right; sits on the left. The main "do it" action, e.g. Add to today. */
  leftAction?: SwipeAction | null;
  /** Revealed by swiping left; sits on the right, e.g. Done, Remove, Delete */
  rightAction?: SwipeAction | null;
  /** False while the row is busy (e.g. being dragged) */
  enabled?: boolean;
  /** Rounds the row's clip, to match the card inside */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const swipePalette = {
  light: {
    destructive: "#dc2626",
    success: "#15803d",
    primary: "#0369a1",
    neutral: "#6b7280",
    warning: "#b45309",
  },
  dark: {
    destructive: "#b91c1c",
    success: "#15803d",
    primary: "#0369a1",
    neutral: "#4b5563",
    warning: "#b45309",
  },
} as const satisfies Record<ColorScheme, Record<string, string>>;

/** Swipe button colors that keep white text readable in light and dark mode */
export function useSwipeColors() {
  const { scheme } = useTheme();
  return swipePalette[scheme];
}

// Only one row is open at a time: opening another closes the last one, like iOS lists
let closeOpenRow: (() => void) | null = null;

/**
 * A row that slides to show an action behind it, like iOS lists: swipe left for `rightAction`,
 * right for `leftAction`, then tap the button. Swiping most of the way across runs the action
 * outright (unless `isFullSwipe: false`). A light haptic marks the point where letting go does
 * something. Put the row's own content (usually a card) inside.
 *
 * VoiceOver can't swipe: give the content `accessibilityActions` for the same actions.
 */
export function SwipeableRow({
  leftAction,
  rightAction,
  enabled = true,
  borderRadius = radius.lg,
  style,
  children,
}: SwipeableRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const [rowWidth, setRowWidth] = useState(0);
  // The side whose full swipe is armed right now, read when he lets go
  const armedSideRef = useRef<Side | null>(null);
  const isDraggingRef = useRef(false);
  const closeRef = useRef(() => swipeableRef.current?.close());

  const fullSwipeDistance = Math.max(FULL_SWIPE_MIN, rowWidth * FULL_SWIPE_FRACTION);
  const actionFor = (side: Side) => (side === "left" ? leftAction : rightAction);
  const isFullSwipe = (side: Side) => actionFor(side)?.isFullSwipe !== false;

  const handleLayout = (event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  };

  const handlePress = (action: SwipeAction) => {
    swipeableRef.current?.close();
    action.onPress();
  };

  const handleCross = (side: Side, isPast: boolean) => {
    // Springing back after he lets go isn't a decision
    if (!isDraggingRef.current) return;
    if (isPast) {
      haptics.swipeThreshold();
      armedSideRef.current = side;
    } else if (armedSideRef.current === side) {
      armedSideRef.current = null;
    }
  };

  const handleStartDrag = () => {
    isDraggingRef.current = true;
    armedSideRef.current = null;
    if (closeOpenRow && closeOpenRow !== closeRef.current) closeOpenRow();
  };

  const handleWillOpen = (direction: SwipeDirection) => {
    isDraggingRef.current = false;
    // Moving right shows the left action
    const side: Side = direction === SwipeDirection.RIGHT ? "left" : "right";
    const action = actionFor(side);
    if (action && isFullSwipe(side) && armedSideRef.current === side) {
      armedSideRef.current = null;
      handlePress(action);
      return;
    }
    closeOpenRow = closeRef.current;
  };

  const handleWillClose = () => {
    isDraggingRef.current = false;
    armedSideRef.current = null;
    if (closeOpenRow === closeRef.current) closeOpenRow = null;
  };

  const renderActions = (side: Side) => {
    const action = actionFor(side);
    if (!action) return undefined;
    const isFull = isFullSwipe(side);
    return function renderSideActions(
      _progress: SharedValue<number>,
      translation: SharedValue<number>,
    ) {
      return (
        <SwipeActionButton
          side={side}
          action={action}
          translation={translation}
          // Without a full swipe, the haptic marks where letting go keeps it open
          triggerDistance={isFull ? fullSwipeDistance : OPEN_THRESHOLD}
          isFullSwipe={isFull}
          onCross={handleCross}
          onPress={handlePress}
        />
      );
    };
  };

  return (
    // ReanimatedSwipeable keeps its own onLayout, so the width is measured out here
    <View onLayout={handleLayout} style={style}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={FRICTION}
        leftThreshold={OPEN_THRESHOLD}
        rightThreshold={OPEN_THRESHOLD}
        overshootLeft={!!leftAction && isFullSwipe("left")}
        overshootRight={!!rightAction && isFullSwipe("right")}
        enabled={enabled}
        renderLeftActions={renderActions("left")}
        renderRightActions={renderActions("right")}
        onSwipeableOpenStartDrag={handleStartDrag}
        onSwipeableCloseStartDrag={handleStartDrag}
        onSwipeableWillOpen={handleWillOpen}
        onSwipeableWillClose={handleWillClose}
        containerStyle={{ borderRadius, borderCurve: "continuous" }}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

interface SwipeActionButtonProps {
  side: Side;
  action: SwipeAction;
  /** The row's offset: positive when slid right (left action showing), negative when slid left */
  translation: SharedValue<number>;
  /** How far the row slides before letting go does something (opens it, or runs a full swipe) */
  triggerDistance: number;
  isFullSwipe: boolean;
  onCross: (side: Side, isPast: boolean) => void;
  onPress: (action: SwipeAction) => void;
}

function SwipeActionButton({
  side,
  action,
  translation,
  triggerDistance,
  isFullSwipe,
  onCross,
  onPress,
}: SwipeActionButtonProps) {
  const direction = side === "left" ? 1 : -1;

  useAnimatedReaction(
    () => translation.value * direction >= triggerDistance,
    (isPast, wasPast) => {
      if (wasPast !== null && isPast !== wasPast) scheduleOnRN(onCross, side, isPast);
    },
  );

  // Past the button the action stretches with the row (drawn wider than its box, so the
  // swipeable's measured width stays put), and its icon grows once a full swipe is armed
  const stretchStyle = useAnimatedStyle(() => ({
    width: Math.max(ACTION_WIDTH, translation.value * direction - ACTION_GAP),
    // Hidden while the row is closed, so it can't show around the card's rounded corners or
    // behind a card lifted for its context menu
    opacity: translation.value * direction > 0.5 ? 1 : 0,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(
          isFullSwipe && translation.value * direction >= triggerDistance ? 1.25 : 1,
        ),
      },
    ],
  }));

  return (
    <View
      // VoiceOver reaches these actions through the row's own accessibilityActions
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.action,
        side === "left" ? { marginRight: ACTION_GAP } : { marginLeft: ACTION_GAP },
      ]}
    >
      <Animated.View
        style={[styles.stretch, side === "left" ? { left: 0 } : { right: 0 }, stretchStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={() => onPress(action)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: action.color, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Animated.View style={iconStyle}>
            <SymbolView name={action.icon} size={24} tintColor="#ffffff" />
          </Animated.View>
          <Text variant="label" style={styles.label} maxFontSizeMultiplier={1.6} numberOfLines={2}>
            {action.label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { width: ACTION_WIDTH, minHeight: minTapSize },
  stretch: { position: "absolute", top: 0, bottom: 0 },
  button: {
    flex: 1,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  label: { color: "#ffffff", textAlign: "center" },
});
