"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

interface AutoGrowTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Pixel cap for the textarea height. Default ~8 lines. */
  maxHeight?: number;
}

/**
 * Auto-resizing textarea. Grows with content up to `maxHeight`, then scrolls.
 * Used for both the main message composer and the inline-edit composer.
 */
export const AutoGrowTextarea = forwardRef<
  HTMLTextAreaElement,
  AutoGrowTextareaProps
>(function AutoGrowTextarea(
  {
    value,
    onValueChange,
    onKeyDown,
    className,
    maxHeight = 160,
    rows = 1,
    ...rest
  },
  ref: Ref<HTMLTextAreaElement>,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  // Forward the ref while keeping our own handle for the resize effect.
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  // Resize on every value change. Reset to 0 first so it shrinks when text
  // is deleted, then snap to scrollHeight capped at maxHeight.
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    onValueChange(e.target.value);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
  };

  return (
    <textarea
      ref={innerRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      rows={rows}
      className={cn("resize-none", className)}
      {...rest}
    />
  );
});
