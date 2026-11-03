// Client helpers shared by the job mic and the global mic

export {
  FOLLOW_UP_MS,
  RESULT_TOAST_MS,
  RETRY_TOAST_MS,
  describeToday,
  isQuestion,
} from "@shared/voice/voiceClient";

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
