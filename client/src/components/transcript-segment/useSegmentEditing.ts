import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Segment } from "@/lib/store";

interface UseSegmentEditingParams {
  readonly segment: Segment;
  readonly editRequested?: boolean;
  readonly onEditRequestHandled?: () => void;
  readonly onTextChange: (text: string) => void;
  readonly onSelect: () => void;
  readonly getViewHeight?: () => number | null;
}

export function useSegmentEditing({
  segment,
  editRequested = false,
  onEditRequestHandled,
  onTextChange,
  onSelect,
  getViewHeight,
}: UseSegmentEditingParams) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(segment.text);
  const [editHeight, setEditHeight] = useState<number | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftText(segment.text);
    }
  }, [isEditing, segment.text]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
    }
  }, [isEditing]);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const textarea = editInputRef.current;
    if (!textarea) return;
    if (editHeight) {
      textarea.style.height = `${editHeight}px`;
    }
  }, [editHeight, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    setEditHeight(null);
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const body = document.body;
    const previousValue = body.dataset.transcriptEditing;
    body.dataset.transcriptEditing = "true";
    return () => {
      if (previousValue === undefined) {
        delete body.dataset.transcriptEditing;
      } else {
        body.dataset.transcriptEditing = previousValue;
      }
    };
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setDraftText(segment.text);
    const measuredHeight = getViewHeight?.() ?? null;
    setEditHeight(measuredHeight && measuredHeight > 0 ? measuredHeight : null);
    setIsEditing(true);
  }, [getViewHeight, segment.text]);

  const handleSaveEdit = useCallback(() => {
    setIsEditing(false);
    onTextChange(draftText);
  }, [draftText, onTextChange]);

  const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftText(event.target.value);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftText(segment.text);
  }, [segment.text]);

  const handleEditKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSaveEdit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelEdit();
      }
    },
    [handleCancelEdit, handleSaveEdit],
  );

  const handleSelectKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (isEditing) return;
      if (event.currentTarget !== event.target) return;
      if (event.key === " ") {
        event.preventDefault();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onSelect();
      }
    },
    [isEditing, onSelect],
  );

  const clickTimeoutRef = useRef<number | null>(null);

  const handleSegmentClick = useCallback(() => {
    if (isEditing) return;

    // Clear any pending timeout from a previous click
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    // Delay the selection to allow double-click to cancel it
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      onSelect();
    }, 200);
  }, [isEditing, onSelect]);

  const handleSegmentDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (isEditing) return;

      // Cancel pending single-click action FIRST, before any other processing
      if (clickTimeoutRef.current !== null) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }

      event.preventDefault();
      event.stopPropagation();

      handleStartEdit();
    },
    [isEditing, handleStartEdit],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!editRequested) return;
    if (!isEditing) {
      handleStartEdit();
    }
    onEditRequestHandled?.();
  }, [editRequested, handleStartEdit, isEditing, onEditRequestHandled]);

  return {
    draftText,
    editInputRef,
    handleCancelEdit,
    handleEditKeyDown,
    handleSaveEdit,
    handleSegmentClick,
    handleSegmentDoubleClick,
    handleSelectKeyDown,
    handleStartEdit,
    handleDraftChange,
    editHeight,
    isEditing,
  };
}
