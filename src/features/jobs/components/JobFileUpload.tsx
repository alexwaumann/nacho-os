import { Upload } from "lucide-react";
import { useRef } from "react";

interface JobFileUploadProps {
  onFilesSelected: (files: Array<File>) => void;
}

export function JobFileUpload({ onFilesSelected }: JobFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleContainerClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
      // Reset input value to allow selecting same file again if needed
      e.target.value = "";
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="border-2 border-dashed border-primary/30 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept=".pdf,image/*"
      />
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
        <Upload size={32} />
      </div>
      <p className="text-primary font-bold text-center">Tap to upload PDFs or Images</p>
    </div>
  );
}
