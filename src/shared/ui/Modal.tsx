"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** true일 때만 backdrop 클릭/Esc로 onClose 호출 (작업 진행 중엔 false로 닫기 방지) */
  dismissable?: boolean;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, dismissable = false, children }: ModalProps) {
  // Esc 닫기는 dismissable일 때만 활성화
  useEffect(() => {
    if (!isOpen || !dismissable || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, dismissable, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (dismissable) onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      {/* 카드 영역 클릭은 backdrop으로 전파 안 함 */}
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl">
        {dismissable && onClose && (
          <button
            onClick={onClose}
            aria-label="닫기"
            className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-200 shadow-lg hover:bg-gray-600"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
