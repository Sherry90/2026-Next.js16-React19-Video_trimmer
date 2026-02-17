'use client';

import { useState, useCallback, useEffect } from 'react';
import { formatTime, parseFlexibleTime } from '@/utils/timeFormatter';

interface TimeInputProps {
  label: string;
  value: number | null;
  onChange: (time: number | null) => void;
  max?: number;
  min?: number;
  disabled?: boolean;
  placeholder?: string;
}

export function TimeInput({
  label,
  value,
  onChange,
  max,
  min = 0,
  disabled = false,
  placeholder = '00:00:00.000',
}: TimeInputProps) {
  const [inputValue, setInputValue] = useState(value === null ? '' : formatTime(value));
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setInputValue(value === null ? '' : formatTime(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (inputValue.trim() === '') {
      onChange(null);
      setInputValue('');
      return;
    }
    const parsedTime = parseFlexibleTime(inputValue);
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
        return;
      }

      // 제어 키 허용
      if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'].includes(e.key)) return;

      // Ctrl/Cmd 조합 허용 (붙여넣기, 복사, 전체선택 등)
      if (e.ctrlKey || e.metaKey) return;

      // 허용 문자: 숫자, 콜론, 점
      if (/^[0-9:.]$/.test(e.key)) return;

      // 나머지 차단
      e.preventDefault();
    },
    []
  );

  // value가 변경되면 input도 업데이트 (focus 중이 아닐 때만)
  useEffect(() => {
    if (!isFocused) {
      const expected = value === null ? '' : formatTime(value);
      if (inputValue !== expected) {
        setInputValue(expected);
      }
    }
  }, [value, isFocused, inputValue]);

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
        placeholder={placeholder}
        className={`
          px-3 py-1 text-sm font-mono
          border border-gray-300 dark:border-gray-600
          rounded
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      />
    </div>
  );
}
