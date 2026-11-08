import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

/** Work orders being read (from Add Job), with failed ones he can dismiss. */
export function WorkOrderQueue() {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const queue = useQuery(api.jobs.listQueue, isAuthenticated ? {} : "skip");
  const removeQueueItem = useMutation(api.jobs.removeQueueItem);
  const iconSize = useScaledSize(24);

  const handleRemove = async (queueId: Id<"jobProcessingQueue">) => {
    try {
      await removeQueueItem({ queueId });
    } catch (error) {
      toastError("Couldn't remove it", error);
    }
  };

  if (!queue || queue.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text variant="heading">Reading work orders</Text>
      {queue.map((item) => {
        const isFailed = item.status === "failed";
        return (
          <Card
            key={item._id}
            style={[styles.row, isFailed && { borderColor: colors.destructive }]}
          >
            {isFailed ?
              <SymbolView
                name="exclamationmark.circle.fill"
                size={iconSize}
                tintColor={colors.destructive}
              />
            : <ActivityIndicator color={colors.primary} />}
            <View style={styles.body}>
              <Text variant="label" numberOfLines={1}>
                {item.fileName}
              </Text>
              <Text tone="muted">{isFailed ? item.error : "Reading the details…"}</Text>
            </View>
            {isFailed ?
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.fileName}`}
                onPress={() => void handleRemove(item._id)}
                style={({ pressed }) => [
                  styles.remove,
                  { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <SymbolView name="xmark" size={15} weight="bold" tintColor={colors.foreground} />
              </Pressable>
            : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  body: { flex: 1, gap: 2 },
  remove: {
    width: minTapSize,
    height: minTapSize,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
