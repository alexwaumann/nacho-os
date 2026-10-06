import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentConfig } from "@google/genai";

import { env } from "@/env";

// Type definitions
export type ImageInput = {
  base64: string;
  mimeType: string;
};

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
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
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
