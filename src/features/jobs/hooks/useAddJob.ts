import { useState } from "react";
import { processFiles } from "../api/jobs";

export function useAddJob() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const addFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearState = () => {
    setFiles([]);
    setIsProcessing(false);
    setIsDone(false);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    try {
      const result = await processFiles(files);
      if (result.success) {
        setIsDone(true);
      }
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    files,
    addFiles,
    removeFile,
    clearState,
    isProcessing,
    isDone,
    handleProcess,
  };
}
