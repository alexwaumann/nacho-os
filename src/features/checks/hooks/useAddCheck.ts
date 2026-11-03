import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";

import type { ImageData } from "@/lib/pdf";
import { toIsoDate } from "@/lib/date";
import { getErrorMessage } from "@/lib/errors";
import { processReceiptFile } from "@/lib/pdf";

export type ProcessedCheckData = {
  amount: number;
  payerName?: string;
  date: string; // YYYY-MM-DD format
  detectedAddress?: string;
};

export function useAddCheck() {
  const analyzeCheck = useAction(api.ai.analyzeCheck);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkData, setCheckData] = useState<ProcessedCheckData | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Process file to single image (PDF first page or compressed image)
      const image = await processReceiptFile(file);
      setImageData(image);

      // 2. Read the check with Gemini
      const result = await analyzeCheck({ image });

      if (!result.amount) {
        throw new Error("Could not extract amount from check");
      }

      // 3. Convert and store the extracted data
      const processed: ProcessedCheckData = {
        amount: result.amount,
        payerName: result.payerName,
        date: toIsoDate(result.date),
        detectedAddress: result.detectedAddress,
      };

      setCheckData(processed);
    } catch (err) {
      console.error("Failed to process check:", err);
      const message = getErrorMessage(err, "Failed to process check");
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
