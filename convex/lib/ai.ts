import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Extract job data from images (supports multi-page PDFs converted to images)
 */
export async function extractJobFromImages(images: Array<ImageInput>): Promise<ExtractedJob> {
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
                materialsNeeded: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Specific materials required for THIS task",
                },
                toolsNeeded: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Specific tools required for THIS task",
                },
              },
              required: [
                "category",
                "taskName",
                "specificInstructions",
                "quantity",
                "unit",
                "requiresOnlineOrder",
                "materialsNeeded",
                "toolsNeeded",
              ],
            },
          },
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
* **Tools/Materials (PER TASK):** Infer strictly based on the specific task description. List them under the corresponding task's \`materialsNeeded\` and \`toolsNeeded\` arrays.
* *Example:* "Install LVP" -> materials: ["LVP Flooring", "Transition Strips"], tools: ["Flooring Cutter", "Rubber Mallet", "Spacers"].
* *Example:* "Paint Bathroom" -> materials: ["Paint (Semi-gloss)", "Painter's Tape", "Caulk"], tools: ["Brush", "Roller", "Drop Cloth"].

---
### 3. OUTPUT REQUIREMENT
* Return ONLY valid JSON matching the schema.
* Ensure the \`tasks\` array is exhaustive (capture every row).
* Do not output markdown blocks.
`;

  const imageParts = images.map((img) => ({
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
  } catch (error) {
    console.error("Failed to parse Gemini JSON:", text);
    throw new Error("Failed to parse job extraction response");
  }
}
