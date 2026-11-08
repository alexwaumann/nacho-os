import { Image } from "expo-image";
import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { isPdf } from "@convex/lib/media";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { openImageViewer } from "@/features/job-detail/lib/imageViewer";
import { openPdfViewer } from "@/features/job-detail/lib/pdfViewer";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import type { MediaFile } from "@/features/media/lib/types";

interface ScanSheetProps {
  title: string;
  icon: SFSymbol;
  iconColor: string;
  /** Keeps him from swiping the sheet away, e.g. while saving */
  isLocked?: boolean;
  children: ReactNode;
  /** Buttons pinned to the bottom */
  footer?: ReactNode;
}

/**
 * The page sheet a receipt or check is read and saved in: a title row, scrolling content and
 * buttons pinned to the bottom.
 */
export function ScanSheet({
  title,
  icon,
  iconColor,
  isLocked = false,
  children,
  footer,
}: ScanSheetProps) {
  const { colors } = useTheme();
  const circleSize = useScaledSize(44, 1.5);

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: !isLocked }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <View
            style={[
              styles.icon,
              { width: circleSize, height: circleSize, backgroundColor: `${iconColor}26` },
            ]}
          >
            <SymbolView name={icon} size={circleSize / 2} tintColor={iconColor} />
          </View>
          <Text variant="title" style={styles.flex}>
            {title}
          </Text>
        </View>
        {children}
      </ScrollView>
      {footer ?
        <SheetFooter>{footer}</SheetFooter>
      : null}
    </View>
  );
}

/** Two buttons side by side, wrapping under each other when the text is very large */
export function FooterButtons({ children }: { children: ReactNode }) {
  return <View style={styles.footerButtons}>{children}</View>;
}

/** The photo (or PDF) being read; tap to see it full screen */
export function PhotoPreview({ image, caption }: { image: MediaFile; caption: string }) {
  const { colors } = useTheme();
  const pdfIconSize = useScaledSize(32);
  if (isPdf(image.mimeType)) {
    const name = image.name ?? "PDF";
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${caption}: ${name}. Tap to open it.`}
        onPress={() => openPdfViewer({ uri: image.uri, title: name })}
        style={({ pressed }) => [
          styles.pdf,
          { borderColor: colors.border, backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <SymbolView name="doc.richtext" size={pdfIconSize} tintColor={colors.primary} />
        <View style={styles.flex}>
          <Text variant="label" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" tone="muted">
            PDF · Tap to open it
          </Text>
        </View>
        <SymbolView name="chevron.right" size={15} tintColor={colors.mutedForeground} />
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`${caption}. Tap to see it bigger.`}
      onPress={() => openImageViewer([{ uri: image.uri, caption }])}
      style={({ pressed }) => [
        styles.preview,
        { borderColor: colors.border, backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Image source={{ uri: image.uri }} style={styles.previewImage} contentFit="contain" />
    </Pressable>
  );
}

/** Shown while Gemini reads the photo */
export function ReadingView({ image, label }: { image: MediaFile; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={styles.readingRow} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="heading" style={styles.flex}>
          {label}
        </Text>
      </View>
      <PhotoPreview image={image} caption="The photo being read" />
    </View>
  );
}

interface ReadErrorViewProps {
  title: string;
  message: string;
  image: MediaFile;
  onRetry: () => void;
  onNewPhoto: () => void;
  isPicking: boolean;
}

/** The photo couldn't be read: say why, and offer to try again or use another photo */
export function ReadErrorView({
  title,
  message,
  image,
  onRetry,
  onNewPhoto,
  isPicking,
}: ReadErrorViewProps) {
  const { colors } = useTheme();
  const iconSize = useScaledSize(24);
  return (
    <View style={styles.state}>
      <View
        style={[
          styles.errorBox,
          { borderColor: colors.destructive, backgroundColor: `${colors.destructive}14` },
        ]}
      >
        <View style={styles.readingRow}>
          <SymbolView
            name="exclamationmark.triangle.fill"
            size={iconSize}
            tintColor={colors.destructive}
          />
          <Text variant="heading" tone="destructive" style={styles.flex}>
            {title}
          </Text>
        </View>
        <Text>{message}</Text>
      </View>
      <Button title="Try again" onPress={onRetry} />
      <Button
        title="Use a different photo"
        variant="secondary"
        onPress={onNewPhoto}
        isLoading={isPicking}
      />
      <PhotoPreview image={image} caption="The photo that couldn't be read" />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  icon: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtons: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  preview: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: 320 },
  pdf: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  state: { gap: space.lg },
  readingRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  errorBox: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
});
