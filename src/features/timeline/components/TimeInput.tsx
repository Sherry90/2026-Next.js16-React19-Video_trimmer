"use client";

import { useState, useCallback, useId } from "react";
import { formatTime, parseFlexibleTime } from "@/shared/lib/timeFormatter";

interface TimeInputProps {
  label: string;
  value: number | null;
  onChange: (time: number | null) => void;
  max?: number;
  min?: number;
  disabled?: boolean;
  placeholder?: string;
  error?: boolean;
}

export function TimeInput({
  label,
  value,
  onChange,
  max,
  min = 0,
  disabled = false,
  placeholder = "00:00:00.000",
  error = false,
}: TimeInputProps) {
  const inputId = useId();
  const [inputValue, setInputValue] = useState(value === null ? "" : formatTime(value));
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setInputValue(value === null ? "" : formatTime(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (inputValue.trim() === "") {
      onChange(null);
      setInputValue("");
      return;
    }
    const parsedTime = parseFlexibleTime(inputValue);
    const constrainedTime = Math.max(
      min,
      max !== undefined ? Math.min(parsedTime, max) : parsedTime,
    );
    onChange(constrainedTime);
    setInputValue(formatTime(constrainedTime));
  }, [inputValue, onChange, min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      return;
    }

    // 제어 키 허용
    if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End", "Tab"].includes(e.key))
      return;

    // Ctrl/Cmd 조합 허용 (붙여넣기, 복사, 전체선택 등)
    if (e.ctrlKey || e.metaKey) return;

    // 허용 문자: 숫자, 콜론, 점
    if (/^[0-9:.]$/.test(e.key)) return;

    // 나머지 차단
    e.preventDefault();
  }, []);

  // value/focus가 바뀌면 input을 동기화 (focus 중이 아닐 때만) — 렌더 중 조정 패턴.
  // effect 내 setState의 cascading 렌더를 피한다.
  const [prevValue, setPrevValue] = useState(value);
  const [prevFocused, setPrevFocused] = useState(isFocused);
  if (value !== prevValue || isFocused !== prevFocused) {
    setPrevValue(value);
    setPrevFocused(isFocused);
    if (!isFocused) {
      const expected = value === null ? "" : formatTime(value);
      if (inputValue !== expected) {
        setInputValue(expected);
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          px-3 py-1 text-sm font-mono
          border border-gray-300 dark:border-gray-600
          rounded
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? "animate-flash-red" : ""}
        `}
      />
    </div>
  );
}
