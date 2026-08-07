"use client";

import { useEffect, useRef, useState } from "react";
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
  onBlur,
  ...props
}: DraftNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  return (
    <Input
      {...props}
      ref={inputRef}
      type="number"
      value={draft}
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
        const nextValue = Number(event.currentTarget.value);
        if (event.currentTarget.value.trim() === "" || !Number.isFinite(nextValue)) {
          setDraft(String(value));
        }
        onBlur?.(event);
      }}
    />
  );
}
