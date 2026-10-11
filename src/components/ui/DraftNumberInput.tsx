"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type InputProps = React.ComponentProps<typeof Input>;

interface DraftNumberInputProps
  extends Omit<InputProps, "defaultValue" | "onChange" | "type" | "value"> {
  value: number;
  onValueChange: (value: number) => void;
}

export function DraftNumberInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: DraftNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // null 表示未在编辑，此时直接显示外部值；非 null 时保留用户正在输入的文本。
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value);

  return (
    <Input
      {...props}
      ref={inputRef}
      type="number"
      value={displayValue}
      onFocus={(event) => {
        setDraft(String(value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextDraft = event.currentTarget.value;
        setDraft(nextDraft);
        if (nextDraft.trim() === "") return;
        const nextValue = Number(nextDraft);
        if (Number.isFinite(nextValue)) {
          onValueChange(nextValue);
        }
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
