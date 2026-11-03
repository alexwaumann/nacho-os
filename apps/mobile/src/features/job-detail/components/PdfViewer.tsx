import { Directory, File, Paths } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { getViewerPdf } from "../lib/pdfViewer";
import { IconButton } from "./SheetParts";

const isLocalFile = (uri: string) => uri.startsWith("file://");

/** The folder a file:// URI is in, so the web view may read it */
const getFolder = (uri: string) => uri.slice(0, uri.lastIndexOf("/") + 1);

/** A file:// copy of the PDF the share sheet can send, named after its title */
async function getShareableFile(uri: string, title: string): Promise<string> {
  if (isLocalFile(uri)) return uri;
  const name = title.replace(/[^\w ,.-]+/g, "").trim() || "Document";
  // A fresh folder each time, so the same PDF can be shared twice under its own name
  const folder = new Directory(Paths.cache, `share-${Date.now()}`);
  folder.create();
  const file = new File(folder, `${name}.pdf`);
  await File.downloadFileAsync(uri, file);
  return file.uri;
}

/**
 * Full-screen PDF reader (iOS's own, inside a web view): scroll through the pages, pinch to
 * zoom, share. The PDF comes from `openPdfViewer()`.
 */
export function PdfViewer() {
  const [pdf] = useState(getViewerPdf);
  const [isSharing, setIsSharing] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleShare = async () => {
    if (!pdf) return;
    setIsSharing(true);
    try {
      const uri = await getShareableFile(pdf.uri, pdf.title);
      await Sharing.shareAsync(uri, { UTI: "com.adobe.pdf", mimeType: "application/pdf" });
    } catch (error) {
      toastError("Couldn't share the PDF", error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[styles.topBar, { paddingTop: insets.top + space.sm, borderColor: colors.border }]}
      >
        <IconButton icon="xmark" accessibilityLabel="Close" onPress={() => router.back()} />
        <Text variant="label" numberOfLines={2} style={styles.title}>
          {pdf?.title ?? "PDF"}
        </Text>
        {pdf ?
          <IconButton
            icon="square.and.arrow.up"
            accessibilityLabel="Share PDF"
            disabled={isSharing}
            onPress={() => void handleShare()}
            style={isSharing && styles.dim}
          />
        : null}
      </View>

      {!pdf ?
        <View style={styles.center}>
          <Text tone="muted">Nothing to show</Text>
        </View>
      : hasFailed ?
        <View style={styles.center}>
          <Text variant="heading">This PDF didn&apos;t open</Text>
          <Text tone="muted" style={styles.centerText}>
            Check your internet and try again, or share it to open it in another app.
          </Text>
        </View>
      : <WebView
          source={{ uri: pdf.uri }}
          originWhitelist={["*"]}
          allowingReadAccessToURL={isLocalFile(pdf.uri) ? getFolder(pdf.uri) : undefined}
          allowFileAccess
          style={[styles.flex, { backgroundColor: colors.muted }]}
          containerStyle={{ backgroundColor: colors.muted }}
          contentInsetAdjustmentBehavior="never"
          contentInset={{ bottom: insets.bottom }}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          onError={(event) => {
            console.log("PDF didn't load:", event.nativeEvent);
            setHasFailed(true);
          }}
          onHttpError={(event) => {
            console.log("PDF didn't load:", event.nativeEvent.statusCode);
            setHasFailed(true);
          }}
        />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: "center" },
  dim: { opacity: 0.5 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    padding: space.xl,
  },
  centerText: { textAlign: "center" },
});
