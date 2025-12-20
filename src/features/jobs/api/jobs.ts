export interface ProcessResult {
  success: boolean;
  count: number;
  message?: string;
}

/**
 * Mock service to simulate processing uploaded files.
 */
export const processFiles = async (files: File[]): Promise<ProcessResult> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    success: true,
    count: files.length,
    message: `Successfully processed ${files.length} file(s).`,
  };
};
