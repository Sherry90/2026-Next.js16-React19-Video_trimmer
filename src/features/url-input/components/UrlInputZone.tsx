'use client';

import { useState, useCallback, useRef } from 'react';
import { useUrlInput } from '@/features/url-input/hooks/useUrlInput';

export function UrlInputZone() {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLoading, error, handleUrlSubmit, clearError } = useUrlInput();

  const handleSubmit = useCallback(() => {
    if (url.trim() && !isLoading) {
      handleUrlSubmit(url);
    }
  }, [url, isLoading, handleUrlSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pastedText = e.clipboardData.getData('text');
      if (pastedText) {
        // URL auto-detection on paste
        try {
          new URL(pastedText.trim());
          // Valid URL pasted - auto submit after a short delay
          setTimeout(() => {
            handleUrlSubmit(pastedText.trim());
          }, 100);
        } catch {
          // Not a valid URL, just let it paste normally
        }
      }
    },
    [handleUrlSubmit]
  );

  return (
    <div
      className="w-full mt-4"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[11px] text-[#74808c] uppercase tracking-wider">
          or paste URL
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) clearError();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="https://youtube.com/watch?v=... or any supported URL"
          disabled={isLoading}
          data-testid="url-input"
          className="flex-1 px-3 py-2 text-[13px] text-[#d9dce3] bg-[#1a1a1e] border border-white/10 rounded-sm outline-none placeholder:text-[#74808c]/50 focus:border-[#2962ff]/50 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!url.trim() || isLoading}
          data-testid="url-load-button"
          className="px-4 py-2 text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <p className="mt-2 text-[11px] text-[#2962ff] animate-pulse" data-testid="url-loading">
          영상 정보를 가져오는 중...
        </p>
      )}

      {/* Error State */}
      {error && (
        <p className="mt-2 text-[11px] text-red-400" data-testid="url-error">
          {error}
        </p>
      )}

      {/* Supported platforms hint */}
      <p className="mt-2 text-[10px] text-[#74808c] opacity-50">
        YouTube, Chzzk, Twitch, and more (yt-dlp supported sites)
      </p>
    </div>
  );
}
