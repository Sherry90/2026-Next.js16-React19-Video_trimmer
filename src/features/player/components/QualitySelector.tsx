'use client';

import { useState } from 'react';
import { SettingsIcon } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';

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
      <IconButton
        onClick={() => setOpen((o) => !o)}
        aria-label="화질"
        aria-expanded={open}
      >
        <SettingsIcon className="w-5 h-5" />
      </IconButton>
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
