import { AlertCircle, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const FEEDBACK_DISPLAY_TIME = 4000; // 4 seconds

interface SegmentStatusBarProps {
  readonly lastRevisionResult?: {
    status: "success" | "no-changes" | "error";
    message?: string;
    timestamp: number;
  } | null;
  readonly hasPendingRevision: boolean;
}

export function SegmentStatusBar({
  lastRevisionResult,
  hasPendingRevision,
}: SegmentStatusBarProps) {
  if (hasPendingRevision || !lastRevisionResult) return null;
  return <InlineRevisionFeedback result={lastRevisionResult} />;
}

interface InlineRevisionFeedbackProps {
  readonly result: {
    status: "success" | "no-changes" | "error";
    message?: string;
    timestamp: number;
  };
}

function InlineRevisionFeedback({ result }: InlineRevisionFeedbackProps) {
  const [visible, setVisible] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally depend on result.timestamp to re-trigger effect when a new result arrives
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), FEEDBACK_DISPLAY_TIME);
    return () => clearTimeout(timer);
  }, [result.timestamp]);

  if (!visible) return null;
  if (result.status === "success") return null;

  return (
    <div
      className={cn(
        "mt-2 px-3 py-2 text-xs rounded-md flex items-center gap-2 transition-all",
        result.status === "no-changes" && "bg-muted/50 text-muted-foreground",
        result.status === "error" && "bg-destructive/10 text-destructive",
      )}
    >
      {result.status === "no-changes" && (
        <>
          <Minus className="h-3 w-3 flex-shrink-0" />
          <span>No changes needed – the text is already correct.</span>
        </>
      )}
      {result.status === "error" && (
        <>
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{result.message ?? "An error occurred."}</span>
        </>
      )}
    </div>
  );
}
