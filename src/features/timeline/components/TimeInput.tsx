'use client';

import { useState, useCallback } from 'react';
import { formatTime, parseTime } from '@/features/timeline/utils/timeFormatter';

interface TimeInputProps {
  label: string;
  value: number;
  onChange: (time: number) => void;
  max?: number;
  min?: number;
  disabled?: boolean;
}

export function TimeInput({
  label,
  value,
  onChange,
  max,
  min = 0,
  disabled = false,
}: TimeInputProps) {
  const [inputValue, setInputValue] = useState(formatTime(value));
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setInputValue(formatTime(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsedTime = parseTime(inputValue);
    const constrainedTime = Math.max(
      min,
      max !== undefined ? Math.min(parsedTime, max) : parsedTime
    );
    onChange(constrainedTime);
    setInputValue(formatTime(constrainedTime));
  }, [inputValue, onChange, min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      }
    },
    []
  );

  // value가 변경되면 input도 업데이트 (focus 중이 아닐 때만)
  if (!isFocused && inputValue !== formatTime(value)) {
    setInputValue(formatTime(value));
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          px-3 py-1 text-sm font-mono
          border border-gray-300 dark:border-gray-600
          rounded
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        placeholder="00:00:00.000"
      />
    </div>
  );
}
