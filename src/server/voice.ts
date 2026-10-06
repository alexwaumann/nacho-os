import { GoogleGenAI } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";

import type { VoiceCommandInput } from "@/features/voice/lib/agent";
import type { GlobalVoiceCommandInput } from "@/features/voice/lib/globalAgent";
import { env } from "@/env";
import { interpretVoiceCommand } from "@/features/voice/lib/agent";
import { interpretGlobalVoiceCommand } from "@/features/voice/lib/globalAgent";

// ~60s of AAC is well under this; keeps requests inside Netlify's 6MB body limit
const MAX_AUDIO_BASE64_LENGTH = 4 * 1024 * 1024;

/**
 * Interpret a voice command about one job (the job sheet's mic). Returns the transcript, the edits
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

/**
 * Interpret a voice command from the global mic: about any open job or today's route. Returns
 * the transcript, the ops and a short reply; the client applies the ops so it can offer undo.
 */
export const runGlobalVoiceCommand = createServerFn({ method: "POST" })
  .inputValidator((data: GlobalVoiceCommandInput) => {
    if (!data.audio.mimeType.startsWith("audio/")) throw new Error("Expected an audio recording");
    if (data.audio.base64.length > MAX_AUDIO_BASE64_LENGTH) throw new Error("Recording too long");
    return data;
  })
  .handler(async ({ data }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const { ms, ...result } = await interpretGlobalVoiceCommand(ai, data);
    const followUp = data.previous ? `, follow-up to "${data.previous.reply}"` : "";
    const ops = result.ops.map((op) => op.op).join(",");
    console.log(
      `Global voice command (${ms}ms${followUp}): ${result.transcript} → [${ops}] ${result.reply}`,
    );
    return result;
  });
