import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { clearToastsBeforePresenting } from "@/components/ui/toast";

/**
 * Opens the iOS share sheet for a picture at a URL (Messages, Mail, Save Image …), named after
 * its caption. The share sheet needs a file on the phone, so it downloads it first.
 */
export async function shareImage(uri: string, caption?: string) {
  const name = (caption ?? "Picture").replace(/[^\w ,.-]+/g, "").trim() || "Picture";
  // A fresh folder each time, so the same picture can be shared twice under its own name
  const folder = new Directory(Paths.cache, `share-${Date.now()}`);
  folder.create();
  const file = new File(folder, `${name}.jpg`);
  await File.downloadFileAsync(uri, file);
  // iOS won't show the share sheet over a toast's window
  await clearToastsBeforePresenting();
  await Sharing.shareAsync(file.uri, { UTI: "public.jpeg" });
}
