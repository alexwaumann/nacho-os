import { useEffect, useEffectEvent } from "react";

import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { discardedToast, useVoiceMic } from "../hooks/useVoiceMic";
import { VoiceMicButton, VoiceMicDiscardButton, VoiceMicStatus } from "./VoiceMicUI";
import type { Doc } from "../../../../convex/_generated/dataModel";

interface VoiceCommandButtonProps {
  job: Doc<"jobs">;
  /** Closing the job sheet discards a recording in progress. */
  isOpen: boolean;
}

// Floating mic: tap, say what changed on the job, tap again to send
export function VoiceCommandButton({ job, isOpen }: VoiceCommandButtonProps) {
  const { isProcessing, handleRecorded, followUpQuestion } = useVoiceCommand(job);
  const mic = useVoiceMic({
    isProcessing,
    onRecorded: (audio) => void handleRecorded(audio),
  });

  const handleSheetClosed = useEffectEvent(() => {
    if (mic.cancel()) discardedToast("The job was closed, so nothing was sent.");
  });

  useEffect(() => {
    if (!isOpen) handleSheetClosed();
  }, [isOpen]);

  return (
    <div className="pointer-events-none absolute bottom-6 right-5 z-30 flex flex-col items-end gap-3">
      <VoiceMicStatus
        mic={mic}
        processingLabel="Updating job…"
        sendHint="Tap the square to send"
        followUpQuestion={followUpQuestion}
      />
      <div className="flex items-center gap-3">
        <VoiceMicDiscardButton mic={mic} />
        <VoiceMicButton mic={mic} label="Start voice update" />
      </div>
    </div>
  );
}
