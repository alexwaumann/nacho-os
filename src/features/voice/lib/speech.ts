// Speaks the voice assistant's replies with the browser's built-in speech synthesis

let isPrimed = false;

const getSynth = () =>
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

/** An en-US voice, preferring the device default, then an on-device one. */
function pickVoice(voices: Array<SpeechSynthesisVoice>) {
  const english = voices.filter((voice) => voice.lang.replace("_", "-").startsWith("en-US"));
  return (
    english.find((voice) => voice.default) ??
    english.find((voice) => voice.localService) ??
    english.at(0)
  );
}

/**
 * iOS only lets a page speak after it has spoken during a tap. Called from the mic tap so the
 * reply, which arrives later, can be read out.
 */
export function primeSpeech() {
  const synth = getSynth();
  if (!synth || isPrimed) return;
  isPrimed = true;
  const utterance = new SpeechSynthesisUtterance("");
  utterance.volume = 0;
  synth.speak(utterance);
}

/** Reads text out loud, cutting off anything still being read. Does nothing without the API. */
export function speak(text: string) {
  const synth = getSynth();
  const trimmed = text.trim();
  if (!synth || !trimmed) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = "en-US";
  const voice = pickVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  // A touch slower than the default, easier to follow on a job site
  utterance.rate = 0.95;
  synth.speak(utterance);
}

/** Stops a reply being read, e.g. when he starts talking again. */
export function cancelSpeech() {
  getSynth()?.cancel();
}
