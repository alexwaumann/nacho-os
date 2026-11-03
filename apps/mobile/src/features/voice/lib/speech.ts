import * as Speech from "expo-speech";
import type { Voice } from "expo-speech";

// Reads the voice assistant's replies out loud with the iPhone's built-in voices

// A little slower than normal, easier to follow in a truck or on a job site
const SPEECH_RATE = 0.9;

let voicePromise: Promise<string | undefined> | null = null;

/**
 * The clearest US English voice on the phone: an Enhanced (downloaded, natural-sounding) one if
 * there is one, else the system's default en-US voice.
 */
function pickVoice(voices: Voice[]) {
  const english = voices.filter((voice) => voice.language.replace("_", "-") === "en-US");
  const enhanced = english.filter((voice) => voice.quality === "Enhanced");
  // Siri-style novelty voices (Bells, Whisper …) are never Enhanced, so this skips them
  return (
    enhanced.find((voice) => /samantha|ava|evan|nathan|zoe|tom/i.test(voice.name)) ?? enhanced[0]
  );
}

function getVoice() {
  voicePromise ??= Speech.getAvailableVoicesAsync()
    .then((voices) => pickVoice(voices)?.identifier)
    .catch((error: unknown) => {
      console.log("Listing speech voices failed:", error);
      return undefined;
    });
  return voicePromise;
}

/** Reads text out loud, cutting off anything still being read. */
export async function speak(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  void Speech.stop();
  const voice = await getVoice();
  Speech.speak(trimmed, {
    language: "en-US",
    voice,
    rate: SPEECH_RATE,
    // Let iOS manage the speech's own audio session: it ducks the radio or music while speaking
    // and isn't left on the earpiece by the recording session
    useApplicationAudioSession: false,
    onStart: () => console.log(`[voice] speaking: ${trimmed}`),
    onError: (error) => console.log("[voice] speech failed:", error),
  });
}

/** Stops a reply being read, e.g. when he starts talking again. */
export function stopSpeaking() {
  void Speech.stop();
}
