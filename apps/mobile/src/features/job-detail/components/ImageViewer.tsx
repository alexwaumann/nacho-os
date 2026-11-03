import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { space } from "@/lib/theme";

import { getViewerImages } from "../lib/imageViewer";
import type { ViewerImage } from "../lib/imageViewer";
import { IconButton } from "./SheetParts";

const MAX_ZOOM = 6;
const BUTTON_BACKGROUND = "rgba(0, 0, 0, 0.6)";

/**
 * Full-screen, black image viewer: swipe between images, pinch (or double-tap) to zoom, share.
 * Images come from `openImageViewer()`.
 */
export function ImageViewer() {
  const [{ images, index: startIndex }] = useState(getViewerImages);
  const [index, setIndex] = useState(startIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const image = images[index];
  const hasMultiple = images.length > 1;

  const handleClose = () => router.back();

  const handleShare = async () => {
    if (!image) return;
    setIsSharing(true);
    try {
      // The share sheet needs a file on the phone, so download it first
      const name = (image.caption ?? "Picture").replace(/[^\w ,.-]+/g, "").trim() || "Picture";
      // A fresh folder each time, so the same picture can be shared twice under its own name
      const folder = new Directory(Paths.cache, `share-${Date.now()}`);
      folder.create();
      const file = new File(folder, `${name}.jpg`);
      await File.downloadFileAsync(image.uri, file);
      await Sharing.shareAsync(file.uri, { UTI: "public.jpeg" });
    } catch (error) {
      toastError("Couldn't share the picture", error);
    } finally {
      setIsSharing(false);
    }
  };

  const handlePageChange = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      setIndex(next);
      setIsZoomed(false);
    }
  };

  return (
    <View style={styles.screen}>
      {images.length === 0 ?
        <View style={styles.center}>
          <Text tone="onPrimary">Nothing to show</Text>
        </View>
      : <FlatList
          data={images}
          horizontal
          pagingEnabled
          // A zoomed image pans instead of flipping to the next one
          scrollEnabled={!isZoomed}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${i}-${item.uri}`}
          onMomentumScrollEnd={handlePageChange}
          renderItem={({ item }) => (
            <ZoomableImage image={item} width={width} height={height} onZoomChange={setIsZoomed} />
          )}
        />
      }

      {/* Top bar: close, count and caption, share */}
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <IconButton
          icon="xmark"
          accessibilityLabel="Close"
          tint="#fff"
          background={BUTTON_BACKGROUND}
          onPress={handleClose}
        />
        <View style={styles.caption} pointerEvents="none">
          {hasMultiple ?
            <Text variant="label" style={styles.white} accessibilityLiveRegion="polite">
              {index + 1} of {images.length}
            </Text>
          : null}
          {image?.caption ?
            <Text variant="caption" style={styles.white} numberOfLines={2}>
              {image.caption}
            </Text>
          : null}
        </View>
        {image ?
          <IconButton
            icon="square.and.arrow.up"
            accessibilityLabel="Share picture"
            tint="#fff"
            background={BUTTON_BACKGROUND}
            disabled={isSharing}
            onPress={() => void handleShare()}
            style={isSharing && styles.dim}
          />
        : null}
      </View>
    </View>
  );
}

interface ZoomableImageProps {
  image: ViewerImage;
  width: number;
  height: number;
  onZoomChange: (isZoomed: boolean) => void;
}

/** One page: an iOS zooming scroll view, so pinch and pan are native */
function ZoomableImage({ image, width, height, onZoomChange }: ZoomableImageProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const zoomRef = useRef(1);
  const lastTapRef = useRef(0);
  // The touch in progress: where it started, and whether it stopped being a plain tap
  const touchRef = useRef({ x: 0, y: 0, time: 0, isTap: false });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const zoom = event.nativeEvent.zoomScale ?? 1;
    const wasZoomed = zoomRef.current > 1.01;
    zoomRef.current = zoom;
    if (wasZoomed !== zoom > 1.01) onZoomChange(zoom > 1.01);
  };

  // Double tap zooms in on that spot, or back out
  const handleTap = (x: number, y: number) => {
    const now = Date.now();
    if (now - lastTapRef.current > 300) {
      lastTapRef.current = now;
      return;
    }
    lastTapRef.current = 0;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const rect =
      zoomRef.current > 1.01 ?
        { x: 0, y: 0, width, height }
      : { x: x - width / 6, y: y - height / 6, width: width / 3, height: height / 3 };
    scroll.scrollResponderZoomTo({ ...rect, animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ width, height }}
      contentContainerStyle={{ width, height }}
      maximumZoomScale={MAX_ZOOM}
      minimumZoomScale={1}
      centerContent
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      onScroll={handleScroll}
      onTouchStart={(event) => {
        const { locationX, locationY, touches } = event.nativeEvent;
        touchRef.current = {
          x: locationX,
          y: locationY,
          time: Date.now(),
          isTap: touches.length <= 1,
        };
      }}
      onTouchMove={(event) => {
        const { locationX, locationY, touches } = event.nativeEvent;
        const touch = touchRef.current;
        if (touches.length > 1 || Math.hypot(locationX - touch.x, locationY - touch.y) > 10) {
          touch.isTap = false;
        }
      }}
      onTouchEnd={(event) => {
        const touch = touchRef.current;
        if (touch.isTap && Date.now() - touch.time < 250) {
          handleTap(event.nativeEvent.locationX, event.nativeEvent.locationY);
        } else {
          lastTapRef.current = 0;
        }
      }}
    >
      <Image
        source={{ uri: image.uri }}
        style={{ width, height }}
        contentFit="contain"
        transition={150}
        accessibilityLabel={image.caption ?? "Picture"}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  caption: { flex: 1, gap: space.xs, paddingTop: space.sm },
  white: { color: "#fff" },
  dim: { opacity: 0.5 },
});
