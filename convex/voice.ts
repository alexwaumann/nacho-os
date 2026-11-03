"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { createGeminiClient } from "./lib/ai";
import { requireIdentity } from "./lib/auth";
import { assertAudio, mediaValidator } from "./lib/media";
import { interpretVoiceCommand } from "./lib/voice/agent";
import { interpretGlobalVoiceCommand } from "./lib/voice/globalAgent";
import {
  globalVoiceContextValidator,
  voiceFollowUpValidator,
  voiceJobContextValidator,
} from "./lib/voice/validators";

/**
 * Interpret a voice command about one job (the job sheet's mic). Returns the transcript, the edits
 * to make and a short reply; the client applies the edits so it can offer undo.
 */
export const runVoiceCommand = action({
  args: {
    audio: mediaValidator,
    job: voiceJobContextValidator,
    today: v.string(),
    previous: v.optional(voiceFollowUpValidator),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    assertAudio(args.audio);
    const { ms, ...result } = await interpretVoiceCommand(createGeminiClient(), args);
    const followUp = args.previous ? `, follow-up to "${args.previous.reply}"` : "";
    console.log(`Voice command (${ms}ms${followUp}): ${result.transcript} → ${result.reply}`);
    return result;
  },
});

/**
 * Interpret a voice command from the global mic: about any open job or today's route. Returns
 * the transcript, the ops and a short reply; the client applies the ops so it can offer undo.
 */
export const runGlobalVoiceCommand = action({
  args: {
    audio: mediaValidator,
    context: globalVoiceContextValidator,
    today: v.string(),
    previous: v.optional(voiceFollowUpValidator),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    assertAudio(args.audio);
    const { ms, ...result } = await interpretGlobalVoiceCommand(createGeminiClient(), args);
    const followUp = args.previous ? `, follow-up to "${args.previous.reply}"` : "";
    const ops = result.ops.map((op) => op.op).join(",");
    console.log(
      `Global voice command (${ms}ms${followUp}): ${result.transcript} → [${ops}] ${result.reply}`,
    );
    return result;
  },
});
