interface VoiceResultDetailsProps {
  /** One line per change made. */
  lines: Array<string>;
  /** Things that couldn't be done, shown in red. */
  skipped: Array<string>;
  transcript: string;
  /** Changes Undo can't take back. */
  notUndoable?: Array<string>;
}

/** The body of a voice result toast: the changes, what was skipped and what was heard. */
export function VoiceResultDetails({
  lines,
  skipped,
  transcript,
  notUndoable = [],
}: VoiceResultDetailsProps) {
  return (
    <div className="space-y-2 mt-1">
      {lines.length > 0 && (
        <ul className="space-y-0.5 font-semibold text-foreground">
          {lines.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      )}
      {skipped.length > 0 && (
        <ul className="space-y-0.5 text-destructive">
          {skipped.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      )}
      {notUndoable.length > 0 && (
        <p className="text-muted-foreground">Undo can't take back: {notUndoable.join("; ")}</p>
      )}
      {transcript && <p className="italic text-muted-foreground">Heard: “{transcript}”</p>}
    </div>
  );
}
