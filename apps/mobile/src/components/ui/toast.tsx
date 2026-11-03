import * as Haptics from "expo-haptics";
import { useEffect, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

import { getErrorMessage } from "@shared/errors";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  description?: string;
  /** A button on the toast, e.g. Undo. Pressing it also closes the toast. */
  action?: ToastAction;
  /** How long it stays up, in ms. Longer by default when there's an action to reach. */
  duration?: number;
  /** Reuse an id to replace a toast that's already showing instead of stacking another */
  id?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
  kind: ToastKind;
  title: string;
}

// At most this many at once; the oldest goes first
const MAX_TOASTS = 3;

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
let nextId = 0;

function emit() {
  for (const listener of listeners) listener();
}

function show(kind: ToastKind, title: string, options: ToastOptions = {}) {
  const id = options.id ?? `toast-${nextId++}`;
  const item: ToastItem = { ...options, id, kind, title };
  const existing = toasts.findIndex((t) => t.id === id);
  toasts =
    existing >= 0 ?
      toasts.map((t) => (t.id === id ? item : t))
    : [...toasts, item].slice(-MAX_TOASTS);
  emit();
  if (kind === "error") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
  return id;
}

function dismiss(id?: string) {
  toasts = id === undefined ? [] : toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Short messages at the top of the screen, shown above everything, including sheets. Matches the
 * web app's `toast` (sonner) closely enough to port code:
 * `toast.success("Route cleared")`, `toast.error("Couldn't save", { description })`, and
 * `toast.success("Removed", { action: { label: "Undo", onPress } })`.
 */
export const toast = {
  success: (title: string, options?: ToastOptions) => show("success", title, options),
  error: (title: string, options?: ToastOptions) => show("error", title, options),
  info: (title: string, options?: ToastOptions) => show("info", title, options),
  dismiss,
};

/**
 * An error toast whose description is a plain message for `error` (Convex server errors become
 * "Something went wrong. Please try again."). Logs the full error for debugging.
 */
export function toastError(title: string, error: unknown, options?: ToastOptions) {
  console.log(`${title}:`, error);
  return show("error", title, { ...options, description: getErrorMessage(error) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Renders the toasts. Mount once, at the root. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts);
  const insets = useSafeAreaInsets();

  if (items.length === 0) return null;

  return (
    <FullWindowOverlay>
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { paddingTop: insets.top + space.sm }]}
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </View>
    </FullWindowOverlay>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const { colors } = useTheme();
  const duration = item.duration ?? (item.action ? 6000 : 4000);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), duration);
    return () => clearTimeout(timer);
  }, [item, duration]);

  const accent = {
    success: colors.success,
    error: colors.destructive,
    info: colors.primary,
  }[item.kind];

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      layout={LinearTransition}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: accent },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityHint="Tap to close"
        onPress={() => dismiss(item.id)}
        style={styles.body}
      >
        <Text variant="label">{item.title}</Text>
        {item.description ?
          <Text variant="caption" tone="muted">
            {item.description}
          </Text>
        : null}
      </Pressable>
      {item.action ?
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            dismiss(item.id);
            item.action?.onPress();
          }}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text variant="label" tone="primary">
            {item.action.label}
          </Text>
        </Pressable>
      : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  body: { flex: 1, gap: space.xs },
  action: {
    minHeight: minTapSize,
    minWidth: minTapSize,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
