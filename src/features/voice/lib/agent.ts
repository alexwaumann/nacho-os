import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { voiceResponseSchema } from "./ops";
import type { GoogleGenAI } from "@google/genai";

import type { VoiceFollowUp, VoiceJobContext, VoiceResponse } from "./ops";

// Server-only: turns a recorded voice command into job edits with Gemini

export const VOICE_MODEL = "gemini-3.8-flash";
export const VOICE_THINKING = ThinkingLevel.LOW;

export interface VoiceCommandInput {
  audio: { base64: string; mimeType: string };
  job: VoiceJobContext;
  /** The user's local date, e.g. "Tuesday, 2026-10-06", for resolving "Friday" or "next week". */
  today: string;
  /** Set when this recording may answer a question asked in the previous reply. */
  previous?: VoiceFollowUp;
}

const responseJsonSchema = (() => {
  const { $schema: _schema, ...schema } = z.toJSONSchema(voiceResponseSchema);
  return schema;
})();

function buildFollowUp({ transcript, reply, applied }: VoiceFollowUp) {
  return `
Follow-up: this recording probably answers a question you just asked about this job.
- Earlier they said: ${JSON.stringify(transcript)}
- You replied: ${JSON.stringify(reply)}
- Changes already made from that earlier recording (the job below already includes them; don't \
make them again): ${applied.length > 0 ? applied.join("; ") : "none"}
Combine the earlier request with this answer to decide the edits (e.g. "the exhaust fan" picks \
which task to mark done). If this recording is clearly about something else, handle it on its own.
`;
}

function buildPrompt({ job, today, previous }: Omit<VoiceCommandInput, "audio">) {
  return `You are the voice assistant in a handyman's job app. The user is standing at a job site, \
speaking a short recorded update about the ONE job below. Turn what they say into \
edits to that job.

How to respond:
- transcript: write down exactly what they said.
- ops: the edits, in the order they said them. Only make changes they asked for. Never invent \
tasks, codes, dates or notes.
- reply: one short, plain sentence saying what you changed (past tense), or a short question if \
something was unclear. No markdown.

Tasks:
- Refer to existing tasks by ref ("t3"). People paraphrase ("the faucet", "the caulking", "the \
second one"); match by meaning, area and category. If a phrase could mean more than one task and \
the context doesn't settle it, don't guess: leave it out and ask in the reply.
- "done", "finished", "took care of", "knocked out" → update_task completed: true. "not done", \
"still need to", "uncheck" → completed: false. "Everything's done except X" → mark each other task.
- New work → add_task with a short imperative taskName, a category (reuse an existing one when it \
fits) and the area if they say it. Sizes, colors, brands and how-to go in specificInstructions.
- When they change part of a task (quantity, details, name), use update_task with only the \
changed fields. For materials or tools, send the full new list.
- Details they give about an existing task (size, model, brand, color, what's wrong) belong on \
that task: update_task specificInstructions with the existing instructions plus the new details. \
Don't also put them in the notes.
- Things to buy go in the task's materials; "need to order" → requiresOnlineOrder: true.
- Reordering ("do the deck first", "move the gutters to the end") → move_task with a 1-based \
position.

Notes:
- Observations, reminders and anything that isn't a task or code → append_notes as one short, \
clear sentence in their words (fix grammar, keep their meaning).
- Use set_notes only when they ask to change or delete existing notes; then give the complete new \
notes text.

Access codes:
- add_access_code formatted like the existing codes (e.g. "Lockbox: 4521", "Gate: 1234"). Write \
spoken digits as digits ("four five two one" → "4521").
- To change a code, remove the old one (exact existing string) and add the new one.

Dates and status:
- Today is ${today}. Resolve "Friday", "next Tuesday", "the 15th", "end of the month" to \
YYYY-MM-DD, always in the future. "No due date" / "remove the due date" → clear_due_date.
- set_job_status only when they clearly say the whole job is finished (completed) or needs to be \
reopened (pending).

If the audio is silent or you can't make it out, return no ops and reply "Sorry, I didn't catch \
that."

${previous ? buildFollowUp(previous) : ""}
The job:
${JSON.stringify(job, null, 2)}`;
}

export interface VoiceCommandResult extends VoiceResponse {
  ms: number;
  usage?: { input?: number; output?: number; thoughts?: number };
}

export async function interpretVoiceCommand(
  ai: GoogleGenAI,
  input: VoiceCommandInput,
  options: { model?: string; thinkingLevel?: ThinkingLevel } = {},
): Promise<VoiceCommandResult> {
  const start = Date.now();
  const result = await ai.models.generateContent({
    model: options.model ?? VOICE_MODEL,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,
      thinkingConfig: { thinkingLevel: options.thinkingLevel ?? VOICE_THINKING },
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(input) },
          { inlineData: { data: input.audio.base64, mimeType: input.audio.mimeType } },
        ],
      },
    ],
  });

  const text = result.text ?? "";
  let parsed: VoiceResponse;
  try {
    parsed = voiceResponseSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error("Failed to parse voice command JSON:", text, error);
    throw new Error("Couldn't understand the response. Please try again.");
  }

  return {
    ...parsed,
    ms: Date.now() - start,
    usage: {
      input: result.usageMetadata?.promptTokenCount,
      output: result.usageMetadata?.candidatesTokenCount,
      thoughts: result.usageMetadata?.thoughtsTokenCount,
    },
  };
}
