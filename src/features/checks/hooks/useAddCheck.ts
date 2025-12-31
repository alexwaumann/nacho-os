import { useState } from "react";
import { toast } from "sonner";

import type { ImageInput } from "@/server/gemini";
import { analyzeCheck } from "@/server/gemini";
import { processReceiptFile } from "@/lib/pdf";

/**
 * Convert date from MM/DD/YYYY to YYYY-MM-DD format
 */
function convertDateFormat(dateStr: string | undefined): string {
  if (!dateStr) {
    return new Date().toISOString().split("T")[0];
  }

  // Try to parse MM/DD/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try to parse YYYY-MM-DD format (already correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Fallback to current date
  return new Date().toISOString().split("T")[0];
}

export type ProcessedCheckData = {
  amount: number;
  payerName?: string;
  date: string; // YYYY-MM-DD format
  detectedAddress?: string;
};

export function useAddCheck() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkData, setCheckData] = useState<ProcessedCheckData | null>(null);
  const [imageData, setImageData] = useState<ImageInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Process file to single image (PDF first page or compressed image)
      const image = await processReceiptFile(file);
      setImageData(image);

      // 2. Call server function to analyze check with Gemini
      const result = await analyzeCheck({ data: { image } });

      if (!result.amount) {
        throw new Error("Could not extract amount from check");
      }

      // 3. Convert and store the extracted data
      const processed: ProcessedCheckData = {
        amount: result.amount,
        payerName: result.payerName,
        date: convertDateFormat(result.date),
        detectedAddress: result.detectedAddress,
      };

      setCheckData(processed);
    } catch (err) {
      console.error("Failed to process check:", err);
      const message = err instanceof Error ? err.message : "Failed to process check";
      setError(message);
      toast.error("Failed to process check", {
        description: message,
      });
      // Reset image data on error
      setImageData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setCheckData(null);
    setImageData(null);
    setError(null);
    setIsProcessing(false);
  };

  return {
    isProcessing,
    checkData,
    imageData,
    error,
    handleFileSelect,
    reset,
  };
}
