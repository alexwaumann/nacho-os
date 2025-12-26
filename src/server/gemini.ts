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
  materialsNeeded: Array<string>;
  toolsNeeded: Array<string>;
};

export type ExtractedJob = {
  propertyAddress: string;
  jobSummary?: string;
  tasks: Array<ExtractedTask>;
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
  category: string;
  taskName: string;
  specificInstructions?: string;
  quantity?: number;
  unit?: string;
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

    const taskList = tasks.map((t) => t.taskName).join("; ");
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
