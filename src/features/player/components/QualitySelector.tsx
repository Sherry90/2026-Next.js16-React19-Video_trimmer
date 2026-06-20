'use client';

import { useState } from 'react';

interface QualitySelectorProps {
  heights: number[]; // sorted desc, e.g. [1080, 720, 480]
  selected: number | null; // null = Auto
  onSelect: (height: number | null) => void;
  className?: string;
}

/**
 * 화질 선택기 (프레젠테이셔널 — 순수 props).
 * 톱니 버튼 + 드롭다운(Auto + `${h}p`). 화질이 1개 이하면 숨김(null 반환).
 * (예전 React QualitySelector를 video.js로 포팅했던 것을 React로 복원.)
 */
export function QualitySelector({ heights, selected, onSelect, className = '' }: QualitySelectorProps) {
  const [open, setOpen] = useState(false);

  if (heights.length <= 1) return null;

  const label = (h: number | null) => (h === null ? 'Auto' : `${h}p`);
  const pick = (h: number | null) => {
    onSelect(h);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="화질"
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full right-0 mb-2 min-w-[96px] rounded bg-[#1c1d20] border border-white/10 py-1 shadow-lg z-10"
        >
          {[null, ...heights].map((h) => {
            const active = selected === h;
            return (
              <li key={h ?? 'auto'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(h)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm transition-colors ${
                    active ? 'text-[var(--accent-yellow,#ffee65)]' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="w-3">{active ? '✓' : ''}</span>
                  {label(h)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
