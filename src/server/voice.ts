import { GoogleGenAI } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";

import type { VoiceCommandInput } from "@/features/voice/lib/agent";
import { env } from "@/env";
import { interpretVoiceCommand } from "@/features/voice/lib/agent";

// ~60s of AAC is well under this; keeps requests inside Netlify's 6MB body limit
const MAX_AUDIO_BASE64_LENGTH = 4 * 1024 * 1024;

/**
 * Interpret a press-and-hold voice command about one job. Returns the transcript, the edits
 * to make and a short reply; the client applies the edits so it can offer undo.
 */
export const runVoiceCommand = createServerFn({ method: "POST" })
  .inputValidator((data: VoiceCommandInput) => {
    if (!data.audio.mimeType.startsWith("audio/")) throw new Error("Expected an audio recording");
    if (data.audio.base64.length > MAX_AUDIO_BASE64_LENGTH) throw new Error("Recording too long");
    return data;
  })
  .handler(async ({ data }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const { ms, ...result } = await interpretVoiceCommand(ai, data);
    const followUp = data.previous ? `, follow-up to "${data.previous.reply}"` : "";
    console.log(`Voice command (${ms}ms${followUp}): ${result.transcript} → ${result.reply}`);
    return result;
  });
