import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../env";
import type { GenerateContentConfig } from "@google/genai";

// Type definitions
export type ImageInput = {
  base64: string;
  mimeType: string;
};

export function createGeminiClient() {
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

// Receipt extraction types
export type ExtractedReceipt = {
  storeName: string;
  storeLocation?: string;
  summary?: string;
  total: number;
  date: string; // YYYY-MM-DD format
};

/**
 * Extract receipt data from an image using Gemini
 */
export async function extractReceiptFromImage(image: ImageInput): Promise<ExtractedReceipt> {
  const ai = createGeminiClient();
  const config: GenerateContentConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        storeName: {
          type: Type.STRING,
          description: "The name of the store or business from the receipt header/logo",
        },
        storeLocation: {
          type: Type.STRING,
          nullable: true,
          description: "The store address or location if visible on the receipt",
        },
        summary: {
          type: Type.STRING,
          nullable: true,
          description:
            "Brief summary of main items purchased (e.g. 'Building materials, paint supplies')",
        },
        total: {
          type: Type.NUMBER,
          description: "The total amount paid (final total after tax, as a number)",
        },
        date: {
          type: Type.STRING,
          description: "The purchase date in YYYY-MM-DD format",
        },
      },
      required: ["storeName", "total", "date"],
    },
  };

  const systemPrompt = `
You are an expert Receipt Data Extractor. Analyze the receipt image and extract the following information:

1. **Store Name**: Extract from the receipt header, logo, or top of the receipt. Use the primary business name.

2. **Store Location**: If visible, extract the store address. This is often below the store name. Include city and state if available.

3. **Summary**: Provide a brief (5-10 word) summary of the main categories of items purchased. Examples:
   - "Building materials, lumber, fasteners"
   - "Paint supplies and brushes"
   - "Plumbing fixtures and fittings"
   - "Electrical supplies"

4. **Total**: Extract the FINAL total amount paid (after tax). This is usually at the bottom, labeled "Total", "Grand Total", "Amount Due", or similar. Return as a number without currency symbols.

5. **Date**: Extract the purchase date and format it as YYYY-MM-DD. Look for date formats like:
   - "12/30/2024" -> "2024-12-30"
   - "Dec 30, 2024" -> "2024-12-30"
   - "30-Dec-24" -> "2024-12-30"

If a field is not clearly visible or readable, use your best judgment or omit optional fields.
Return ONLY valid JSON matching the schema.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [
      { text: systemPrompt },
      {
        inlineData: { data: image.base64, mimeType: image.mimeType },
      },
      { text: "Extract receipt details from this image." },
    ],
    config,
  });

  const text = response.text ?? "";
  try {
    return JSON.parse(text) as ExtractedReceipt;
  } catch (error) {
    console.error("Failed to parse receipt Gemini JSON:", text);
    throw new Error("Failed to parse receipt extraction response");
  }
}

// Quick reads of a receipt or check photo before it's tied to a job ("scan first, pick the job
// second"). Every field is optional: the client decides what's missing.

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

/**
 * Read the store, total and date off a receipt image
 */
export async function scanReceiptImage(image: ImageInput): Promise<ReceiptData> {
  const result = await createGeminiClient().models.generateContent({
    model: "gemini-3.5-flash-lite",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          storeName: { type: Type.STRING },
          storeLocation: { type: Type.STRING },
          summary: { type: Type.STRING },
          total: { type: Type.NUMBER },
          date: { type: Type.STRING },
        },
      },
    },
    contents: [
      {
        text: "Analyze this receipt image. Extract the Store Name. Look carefully at the header or footer for the Store Address (Street, City, State, Zip). Also extract a short summary of items, the Total amount, and the Date (MM/DD/YYYY).",
      },
      { inlineData: { data: image.base64, mimeType: image.mimeType } },
    ],
  });

  const text = result.text ?? "";
  try {
    return JSON.parse(text) as ReceiptData;
  } catch {
    console.error("Failed to parse receipt JSON:", text);
    return {};
  }
}

/**
 * Read the amount, payer, date and job address off a check image
 */
export async function scanCheckImage(image: ImageInput): Promise<CheckData> {
  const result = await createGeminiClient().models.generateContent({
    model: "gemini-3.5-flash-lite",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER },
          payerName: { type: Type.STRING },
          date: { type: Type.STRING },
          detectedAddress: {
            type: Type.STRING,
            description: "Address found in memo or address fields related to the service location.",
          },
        },
      },
    },
    contents: [
      {
        text: "Analyze this bank check. Extract the written Amount (as a number), the Payer Name (top left), the Date written on the check (MM/DD/YYYY), and any Address found in the Memo line or on the check that indicates what job this is for.",
      },
      { inlineData: { data: image.base64, mimeType: image.mimeType } },
    ],
  });

  const text = result.text ?? "";
  try {
    return JSON.parse(text) as CheckData;
  } catch {
    console.error("Failed to parse check JSON:", text);
    return {};
  }
}
