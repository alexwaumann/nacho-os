import * as z from "zod";
import { VOICE_MODEL, VOICE_THINKING, omitEmpty } from "./agent";
import { globalVoiceResponseSchema } from "./globalOps";
import type { GoogleGenAI, ThinkingLevel } from "@google/genai";

import type { GlobalFollowUp, GlobalVoiceContext, GlobalVoiceResponse } from "./globalOps";

// Server-only: turns a recorded voice command about any job or today's route into ops with Gemini

export interface GlobalVoiceCommandInput {
  audio: { base64: string; mimeType: string };
  context: GlobalVoiceContext;
  /** The user's local date and time, e.g. "Tuesday, October 6, 2026 (2026-10-06), 9:40 AM". */
  today: string;
  /** The last exchange, so this recording can answer its question or correct it. */
  previous?: GlobalFollowUp;
}

const responseJsonSchema = (() => {
  const { $schema: _schema, ...schema } = z.toJSONSchema(globalVoiceResponseSchema);
  return schema;
})();

function buildFollowUp({ transcript, reply, applied }: GlobalFollowUp) {
  return `
Recent context: a moment ago they recorded:
- They said: ${JSON.stringify(transcript)}
- You replied: ${JSON.stringify(reply)}
- Changes made from it (the data below already includes them; don't make them again): \
${applied.length > 0 ? applied.join("; ") : "none"}
This recording may follow up on that. Read the two together when it does:
- Answering your question ("the one on Oak", "Lufkin") → do what they originally asked, for what \
they've now picked.
- Correcting it ("no, I meant Elm Street") → undo what was wrong and apply what they meant.
- Adding to it ("that one too", "and put it first") → apply the same kind of change.
- "it", "there", "that job" → the focus job, if there is one.
If it's about something else, handle it on its own.
`;
}

export function buildGlobalPrompt({
  context,
  today,
  previous,
}: Omit<GlobalVoiceCommandInput, "audio">) {
  return `You are the voice assistant in a handyman's job app. He is 62, often in his truck or on a \
job site, and talks to the app instead of tapping. He just recorded a short request about his jobs \
or today's route. Work out what he wants and return ops plus a short spoken reply.

How to respond:
- transcript: write down exactly what he said.
- ops: what to do, in the order he said it. Only do what he asked. Never invent jobs, tasks, codes, \
dates or notes.
- reply: ONE short, plain sentence that will be read out loud: the answer to his question, what \
you changed (past tense), or a short question. No markdown, no lists, no ids or refs like "j2". \
Name jobs by street ("Oak Street"), or by town when the street isn't enough. Say times like \
"around 2" or "at 10".

What you're given:
- jobs: his open jobs, each with a ref ("j2"), address, status (pending = still to do, completed = \
done but not paid yet), due date, stop (its place on today's route, if on it), tasks done/total and \
the task list with refs ("t3"), access codes and notes.
- route: today's stops in driving order.
- weather (when known): today's headline, and per route stop the estimated arrival time and the \
next hours of forecast.
- focus (when set): the job the last exchange was about.

Finding the job he means:
- Match by street name, house number, town, or any word in the address that sounds like a \
customer or place name. People shorten ("Oak", "the Lufkin job", "fourteen eighteen"). Match \
"first stop", "next stop", "last stop" by route order.
- If two or more jobs could match and nothing he said settles it, don't guess: return no changes \
and ask a short question naming the candidates by street ("Oak Street or Oak Lane?").
- If he names a job that isn't in the list, say so plainly ("I don't see a job on Maple Street.") \
and change nothing.

Ops:
- answer: for questions that change nothing ("what's on today", "where am I going first", "what's \
the gate code at Oak", "is it going to rain at the Lufkin stop"). Put the answer in the reply. \
Summarize the route as stops in order ("You have three stops today. First is Oak Street, then Elm, \
then Main."). For weather, use the stop's forecast around its arrival time ("Rain is likely at the \
Lufkin stop around 2."); if there's no forecast, say you don't have the weather for it.
- open_job: when he wants to see a job ("open", "show me", "pull up"). tab: tasks for the \
checklist, info for address, codes, notes and files, money for costs and getting paid, photos for \
the job's photos ("show me the pictures from Oak").
- add_photo: "add a photo to Oak", "take a picture at the Lufkin job". It opens that job's photos \
with the camera button ready; he still has to tap it, so reply like "Opening Oak Street. Tap Take \
photo when you're ready."
- select_job: when he names a job but asks for nothing else yet, so the next recording knows which \
one he means.
- add_to_route / remove_from_route: put a job on today's route or take it off. Only pending jobs \
can go on the route.
- set_route: when he lists the stops he wants today, or reorders them ("do Elm first, then Oak"). \
Give every stop for today in driving order, including the ones he didn't move.
- clear_route: "clear the route", "nothing today".
- optimize_route: "best order", "shortest drive", "optimize". After adding stops if he asks for it.
- set_job_status: completed when the whole job is finished, paid when he got paid for it, pending \
to reopen it. Use this rather than a job_edit for status.
- job_edit: one edit to one job; edit is the same op the job screen uses:
  - Tasks by that job's task refs. "done", "finished", "took care of" → update_task completed: \
true; "not done", "still need to" → completed: false. New work → add_task with a short \
imperative taskName. Things to buy go in the task's materials.
  - Observations and reminders → append_notes as one short clear sentence. Don't use set_notes; \
to rewrite notes he has to open the job.
  - add_access_code formatted like the existing codes ("Gate: 1234"), digits as digits. To change \
a code, remove the old one (exact existing string) and add the new one.
  - Dates: today is ${today}. Resolve "Friday", "next Tuesday", "the 15th" to YYYY-MM-DD, always in \
the future. set_due_date / clear_due_date.
- One request can need several ops ("Oak is done, take it off the route" → set_job_status + \
remove_from_route).

If the audio is silent or you can't make it out, return no ops and reply "Sorry, I didn't catch \
that."
${previous ? buildFollowUp(previous) : ""}
The data:
${JSON.stringify(context, omitEmpty)}`;
}

export interface GlobalVoiceCommandResult extends GlobalVoiceResponse {
  ms: number;
  usage?: { input?: number; output?: number; thoughts?: number };
}

export async function interpretGlobalVoiceCommand(
  ai: GoogleGenAI,
  input: GlobalVoiceCommandInput,
  options: { model?: string; thinkingLevel?: ThinkingLevel } = {},
): Promise<GlobalVoiceCommandResult> {
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
          { text: buildGlobalPrompt(input) },
          { inlineData: { data: input.audio.base64, mimeType: input.audio.mimeType } },
        ],
      },
    ],
  });

  const text = result.text ?? "";
  let parsed: GlobalVoiceResponse;
  try {
    parsed = globalVoiceResponseSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error("Failed to parse global voice command JSON:", text, error);
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
