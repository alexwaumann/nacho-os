import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createServerFn } from "@tanstack/react-start";

import { env } from "@/env";

// Type definitions
export type ImageInput = {
  base64: string;
  mimeType: string;
};

export type ExtractedTask = {
  category?: string;
  taskName: string;
  specificInstructions?: string;
  quantity?: number;
  unit?: string;
  requiresOnlineOrder: boolean;
};

export type ExtractedJob = {
  propertyAddress: string;
  jobSummary?: string;
  tasks: Array<ExtractedTask>;
  materialsNeeded: Array<string>;
  toolsNeeded: Array<string>;
  accessCodes: Array<string>;
  targetCompletionDate?: string;
};

export type ReceiptData = {
  storeName?: string;
  storeLocation?: string;
  summary?: string;
  total?: number;
  date?: string;
};

export type CheckData = {
  amount?: number;
  payerName?: string;
  date?: string;
  detectedAddress?: string;
};

export type WeatherData = {
  tempMax: number;
  precipProb: number;
  condition: string;
  code: number;
};

export type TaskInput = {
  id: string;
  text: string;
  completed: boolean;
};

export type WeatherRisk = {
  hasRisk: boolean;
  reason?: string;
};

function getGeminiClient() {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Extract job data from images (supports multi-page PDFs converted to images)
 * Accepts an array of base64 images for multi-page documents
 */
export const extractJobFromFile = createServerFn({ method: "POST" })
  .inputValidator((data: { images: Array<ImageInput> }) => data)
  .handler(async ({ data }) => {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            propertyAddress: {
              type: SchemaType.STRING,
              description: "Street, City, State found in the header",
            },
            jobSummary: { type: SchemaType.STRING },
            tasks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  category: {
                    type: SchemaType.STRING,
                    description: "The broader classification (e.g. Interior, Plumbing)",
                  },
                  taskName: {
                    type: SchemaType.STRING,
                    description: "The main item name",
                  },
                  specificInstructions: {
                    type: SchemaType.STRING,
                    description: "Detailed notes, scope constraints, and location specifics",
                  },
                  quantity: { type: SchemaType.NUMBER, nullable: true },
                  unit: {
                    type: SchemaType.STRING,
                    nullable: true,
                    description: "e.g. EA, SF, LF",
                  },
                  requiresOnlineOrder: {
                    type: SchemaType.BOOLEAN,
                    description: "True if item usually requires lead time/delivery",
                  },
                },
                required: [
                  "category",
                  "taskName",
                  "specificInstructions",
                  "quantity",
                  "unit",
                  "requiresOnlineOrder",
                ],
              },
            },
            materialsNeeded: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            toolsNeeded: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            accessCodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            targetCompletionDate: { type: SchemaType.STRING },
          },
          required: ["propertyAddress", "tasks"],
        },
      },
    });

    const systemPrompt = `
      You are an expert Construction Data Analyst processing "Scope of Work" documents converted to images.
      
      YOUR GOAL: Extract the property address, access codes, and a comprehensive, accurate list of approved tasks into JSON.

      ---
      ### 1. FORMAT RECOGNITION & FIELD MAPPING
      Analyze the header and layout to determine the provider. Apply the specific MAPPING rules below to populate the JSON fields:

      #### A. IF "HUDSON HOMES" (Standard or Photocopy)
      * **CRITICAL FILTER:** Only extract rows where the "APPROVAL STATUS" column contains "Approved" or "Approved as Noted". Ignore "Declined" or "Pending".
      * **Field Mapping:**
          * **category** -> Extract from "CATEGORY" column.
          * **taskName** -> Extract from "MATRIX PRICE" column.
          * **specificInstructions** -> Combine data from "SCOPE NOTES" + "OWNER NOTES". (Ensure location data, usually in Scope Notes, is included here).
          * **quantity** -> Extract from "QTY" column.
          * **unit** -> Extract from "U/M" column.

      #### B. IF "FIRSTKEY HOMES" (Hierarchical Report)
      * **Visual Layout (State Persistence):**
          * The "Walk Area" and "Line Item" columns are often blank for subsequent rows. You must **persist** the last seen value for these columns until a new value or dotted separator line appears.
      * **Handling "Notes":**
          * If a row in the "Details" column starts with "Notes:", it is **NOT** a new task. It is a constraint for the *previous* group.
          * **Action:** Append this "Notes" text to the \`specificInstructions\` field of **every** task belonging to the current "Line Item" group.
      * **Field Mapping:**
          * **category** -> Extract from the (persisted) "Walk Area" column.
          * **taskName** -> Extract from the (persisted) "Line Item" column.
          * **specificInstructions** -> The "Details" column text + (Any "Notes" text found at the end of the group).
          * **quantity** -> Extract from "Qty" column on the specific row.
          * **unit** -> **INFER** from the "Details" text (e.g., "Replace Door" -> EA, "Paint" -> SF).

      #### C. IF "MANCO UNITED" (Simple Estimate)
      * **Field Mapping:**
          * **category** -> Extract from "Activity" column.
          * **taskName** -> Extract from "Description" column.
          * **specificInstructions** -> Leave empty string (unless specific constraints appear in a separate notes field).
          * **quantity** -> Extract from "QTY" column.
          * **unit** -> **INFER** from "Description" text (e.g., "700 LF" -> LF).

      #### D. FALLBACK (Generic Format)
      * Map headers dynamically based on synonyms (e.g., "Item"->"taskName", "Notes"->"specificInstructions").
      * Filter for positive approvals if a "Status" column exists.

      ---
      ### 2. DATA ENRICHMENT RULES (ALL FORMATS)
      * **Access Codes:** Scan the document headers, footers, and "Property Details" sections for "Lockbox", "Gate Code", "Key", "Combo", or "Access". Extract the code values into the \`accessCodes\` array.
      * **Property Address:** Extract from the top header (Street, City, State, Zip).
      * **Online Orders:** Set \`requiresOnlineOrder: true\` for items requiring lead time (Windows, Appliances, Custom Blinds, Cabinets) vs local pickup (Paint, Caulk, Lumber, Cleaning).
      * **Tools/Materials:** Infer strictly based on the task description (e.g., "Install LVP" -> Needs Flooring + Cutter/Mallet).

      ---
      ### 3. OUTPUT REQUIREMENT
      * Return ONLY valid JSON matching the schema.
      * Ensure the \`tasks\` array is exhaustive (capture every row).
      * Do not output markdown blocks.
    `;

    // Build content parts with all images for multi-page context
    const imageParts = data.images.map((img) => ({
      inlineData: { data: img.base64, mimeType: img.mimeType },
    }));

    const result = await model.generateContent([
      { text: systemPrompt },
      ...imageParts,
      { text: "Extract job details from these document pages." },
    ]);

    const text = result.response.text();
    try {
      return JSON.parse(text) as ExtractedJob;
    } catch {
      console.error("Failed to parse Gemini JSON:", text);
      throw new Error("Failed to parse job extraction response");
    }
  });

/**
 * Analyze a receipt image and extract data
 */
export const analyzeReceipt = createServerFn({ method: "POST" })
  .inputValidator((data: { image: ImageInput }) => data)
  .handler(async ({ data }) => {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            storeName: { type: SchemaType.STRING },
            storeLocation: { type: SchemaType.STRING },
            summary: { type: SchemaType.STRING },
            total: { type: SchemaType.NUMBER },
            date: { type: SchemaType.STRING },
          },
        },
      },
    });

    const result = await model.generateContent([
      {
        text: "Analyze this receipt image. Extract the Store Name. Look carefully at the header or footer for the Store Address (Street, City, State, Zip). Also extract a short summary of items, the Total amount, and the Date (MM/DD/YYYY).",
      },
      { inlineData: { data: data.image.base64, mimeType: data.image.mimeType } },
    ]);

    const text = result.response.text();
    try {
      return JSON.parse(text) as ReceiptData;
    } catch {
      console.error("Failed to parse receipt JSON:", text);
      return {} as ReceiptData;
    }
  });

/**
 * Analyze a check image and extract payment data
 */
export const analyzeCheck = createServerFn({ method: "POST" })
  .inputValidator((data: { image: ImageInput }) => data)
  .handler(async ({ data }) => {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            amount: { type: SchemaType.NUMBER },
            payerName: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
            detectedAddress: {
              type: SchemaType.STRING,
              description:
                "Address found in memo or address fields related to the service location.",
            },
          },
        },
      },
    });

    const result = await model.generateContent([
      {
        text: "Analyze this bank check. Extract the written Amount (as a number), the Payer Name (top left), the Date written on the check (MM/DD/YYYY), and any Address found in the Memo line or on the check that indicates what job this is for.",
      },
      { inlineData: { data: data.image.base64, mimeType: data.image.mimeType } },
    ]);

    const text = result.response.text();
    try {
      return JSON.parse(text) as CheckData;
    } catch {
      console.error("Failed to parse check JSON:", text);
      return {} as CheckData;
    }
  });

/**
 * Analyze weather risk for tasks
 */
export const analyzeWeatherRisk = createServerFn({ method: "POST" })
  .inputValidator((data: { tasks: Array<TaskInput>; weather: WeatherData }) => data)
  .handler(async ({ data }) => {
    const { tasks, weather } = data;

    // Skip analysis if weather is mild
    if (weather.precipProb < 30 && weather.tempMax > 40 && weather.tempMax < 95) {
      return { hasRisk: false } as WeatherRisk;
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            hasRisk: { type: SchemaType.BOOLEAN },
            reason: { type: SchemaType.STRING },
          },
          required: ["hasRisk"],
        },
      },
    });

    const taskList = tasks.map((t) => t.text).join("; ");
    const weatherDesc = `${weather.condition}, ${weather.tempMax}°F, ${weather.precipProb}% chance of precipitation`;

    const result = await model.generateContent([
      {
        text: `
          Analyze the following tasks against the weather forecast.
          Tasks: "${taskList}"
          Weather: "${weatherDesc}"
          
          Determine if the weather poses a risk to completing these tasks (e.g. painting outside in rain, roofing in snow).
          Return JSON: { "hasRisk": boolean, "reason": "short explanation" }
        `,
      },
    ]);

    const text = result.response.text();
    try {
      return JSON.parse(text) as WeatherRisk;
    } catch {
      console.error("Failed to parse weather risk JSON:", text);
      return { hasRisk: false } as WeatherRisk;
    }
  });
