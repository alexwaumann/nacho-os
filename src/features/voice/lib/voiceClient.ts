// Client helpers shared by the job mic and the global mic

// Long enough to read the changes and reach for Undo
export const RESULT_TOAST_MS = 15_000;
// A failed send waits longer, since the recording is lost once this closes
export const RETRY_TOAST_MS = 60_000;
// How long the last exchange is sent along, so the next recording can answer or correct it
export const FOLLOW_UP_MS = 2 * 60_000;

export const toastClassNames = {
  title: "text-base! font-bold! leading-snug!",
  description: "text-[15px]! leading-snug!",
  actionButton: "h-10! px-4! text-base! font-bold! rounded-xl!",
};

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The recording as sent to the server: base64 plus the bare mime type. */
export async function toVoiceAudio(audio: Blob) {
  return { base64: await blobToBase64(audio), mimeType: audio.type.split(";")[0] };
}

// Local date with weekday so the model can resolve "Friday" or "next week"
export function describeToday(now = new Date()) {
  const iso = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const long = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${long} (${iso})`;
}

/** A reply that asks something keeps the question pinned by the mic until he answers. */
export const isQuestion = (reply: string) => reply.trim().endsWith("?");
