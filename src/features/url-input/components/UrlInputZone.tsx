'use client';

import { useState, useCallback, useRef } from 'react';
import { useUrlInput } from '@/features/url-input/hooks/useUrlInput';
import { URL_INPUT } from '@/constants/appConfig';
import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/TextInput';
import { UrlDivider } from './UrlDivider';
import { UrlPreview } from './UrlPreview';
import { UrlStatus } from './UrlStatus';

export function UrlInputZone() {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLoading, error, preview, handleUrlSubmit, clearError, clearPreview } = useUrlInput();

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
          }, URL_INPUT.DEBOUNCE_MS);
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
      <UrlDivider />

      {/* URL Input */}
      <div className="flex gap-2">
        <TextInput
          ref={inputRef}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) clearError();
            if (preview) clearPreview();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="https://youtube.com/watch?v=... or any supported URL"
          disabled={isLoading}
          data-testid="url-input"
          className="flex-1 px-3 py-2 text-[13px] text-[#d9dce3] bg-[#1a1a1e] border border-white/10 rounded-sm outline-none placeholder:text-[#74808c]/50 focus:border-[#2962ff]/50 transition-colors disabled:opacity-50"
        />
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!url.trim() || isLoading}
          data-testid="url-load-button"
          className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isLoading ? 'Loading...' : 'Load'}
        </Button>
      </div>

      {/* Instant Preview (oembed/thumbnail) — resolve가 도는 동안 즉시 영상 정보 표시 */}
      {isLoading && preview?.thumbnail && (
        <UrlPreview thumbnail={preview.thumbnail} title={preview.title} />
      )}

      <UrlStatus isLoading={isLoading} error={error} />
    </div>
  );
}
